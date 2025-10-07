#!/usr/bin/env python3
import asyncio, base64, io, json, os, time, logging
from typing import Any, Dict, List, Optional
from datetime import datetime
import aiohttp

import fitz  # PyMuPDF
from fastapi import FastAPI, File, UploadFile, HTTPException, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

from openai import AsyncOpenAI

from pathlib import Path
from collections import defaultdict

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('ocr_api.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Load environment variables from .env file
# Load from server directory specifically
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Load prompts from JSON file
def load_prompts():
    prompts_file = os.path.join(os.path.dirname(__file__), 'prompts.json')
    try:
        with open(prompts_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"Prompts file not found: {prompts_file}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in prompts file: {e}")
        return {}

# Load structure schema from JSON file
def load_structure_schema():
    structure_file = os.path.join(os.path.dirname(__file__), 'structure.json')
    try:
        with open(structure_file, 'r', encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"Structure file not found: {structure_file}")
        return {}
    except json.JSONDecodeError as e:
        logger.error(f"Invalid JSON in structure file: {e}")
        return {}

# Get schema for specific document type
def get_document_schema(doc_type: str, structure_schema: dict) -> dict:
    """Get the schema definition for a specific document type"""
    if not structure_schema or '$defs' not in structure_schema:
        return {}
    defs = structure_schema['$defs']
    if doc_type in defs:
        return defs[doc_type]
    return {}

PROMPTS = load_prompts()

# Validate prompts on startup
if not PROMPTS or not all(k in PROMPTS and "content" in PROMPTS[k] for k in ("classification", "extraction", "chat")):
    raise RuntimeError("prompts.json missing or invalid; expected keys: classification/extraction/chat with 'content'.")
STRUCTURE_SCHEMA = load_structure_schema()

# ---------- Config ----------
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
if not OPENAI_API_KEY:
    raise RuntimeError(
        "Missing OPENAI_API_KEY environment variable. "
        "Please set it by either:\n"
        "1. Creating a .env file with OPENAI_API_KEY=your_key_here\n"
        "2. Running: export OPENAI_API_KEY=your_key_here\n"
        "3. Running: OPENAI_API_KEY=your_key_here uvicorn ocr_api:app --reload"
    )
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]

# Models are now loaded from prompts.json (configurable via Admin UI)
# Fallback to these defaults if not specified in prompts.json
MODEL_CLASSIFY = PROMPTS.get("classification", {}).get("model", "gpt-4o-2024-08-06")
MODEL_EXTRACT = PROMPTS.get("extraction", {}).get("model", "gpt-4o-2024-08-06")

# Assistant IDs (will be created/reused on startup)
CLASSIFY_ASSISTANT_ID = None
EXTRACT_ASSISTANT_ID = None

# Cache for assistant IDs
ASSISTANTS_CACHE_FILE = Path(os.path.join(os.path.dirname(__file__), "assistants.json"))

def _load_assistant_cache() -> dict:
    if ASSISTANTS_CACHE_FILE.exists():
        try:
            return json.load(open(ASSISTANTS_CACHE_FILE, "r", encoding="utf-8"))
        except Exception:
            logger.warning("Failed to read assistants.json cache")
    return {}

def _save_assistant_cache(d: dict) -> None:
    try:
        json.dump(d, open(ASSISTANTS_CACHE_FILE, "w", encoding="utf-8"), indent=2)
    except Exception:
        logger.warning("Failed to save assistants.json cache")

async def _ensure_assistant(name: str, instructions: str, model: str, env_key: str) -> str:
    # Prefer explicit env override, else cache, else create
    env_id = os.getenv(env_key)
    cache = _load_assistant_cache()
    if env_id:
        cache[name] = env_id
        _save_assistant_cache(cache)
        return env_id
    if name in cache and cache[name]:
        return cache[name]
    asst_id = await create_openai_assistant(name=name, instructions=instructions, model=model)
    cache[name] = asst_id
    _save_assistant_cache(cache)
    return asst_id

# File tracking per thread for cleanup
FILES_BY_THREAD: Dict[str, List[str]] = defaultdict(list)

# Thread pool removed - using single-thread per page approach
RENDER_DPI = 200
MAX_CONCURRENCY = 2
OPENAI_TIMEOUT_S = 120
RETRY_MAX = 4
RETRY_BASE_DELAY = 1.25

TYPE_ORDER = [
    "TaxInvoice", "EWayBill", "LorryReceipt", "PackingList", "DeliveryChallan",
    "PurchaseOrder", "CreditNote", "DebitNote", "PaymentAdvice", "ZetwerkInspectionReport",
    "MaterialReport", "WeighmentSlip", "TestCertificate", "GatePass", "BillOfLading",
    "QuotationProforma", "Unknown"
]

# Prompts and schemas are now loaded from JSON files:
# - prompts.json: Contains classification and extraction prompts
# - structure.json: Contains document schemas for all document types

class PageResult(BaseModel):
    page_index: int
    doc_type: str
    confidence: float
    brief_summary: Optional[str] = None
    key_hints: Optional[List[str]] = None

class ExtractedGroup(BaseModel):
    doc_type: str
    page_spans: List[List[int]]
    data: Dict[str, Any]

class OCRResponse(BaseModel):
    num_pages: int
    page_results: List[PageResult]
    grouped_results: List[ExtractedGroup]
    timings_ms: Dict[str, int]

app = FastAPI(title="Bill OCR API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
aclient = AsyncOpenAI(api_key=OPENAI_API_KEY)
sem = asyncio.Semaphore(MAX_CONCURRENCY)

@app.on_event("startup")
async def startup_event():
    """Create or reuse OpenAI assistants on startup"""
    global CLASSIFY_ASSISTANT_ID, EXTRACT_ASSISTANT_ID
    try:
        logger.info("Ensuring OpenAI assistants...")
        CLASSIFY_ASSISTANT_ID = await _ensure_assistant(
            name="Document Classifier",
            instructions=PROMPTS["classification"]["content"],
            model=MODEL_CLASSIFY,
            env_key="CLASSIFY_ASSISTANT_ID"
        )
        EXTRACT_ASSISTANT_ID = await _ensure_assistant(
            name="Document Extractor",
            instructions=PROMPTS["extraction"]["content"],
            model=MODEL_EXTRACT,
            env_key="EXTRACT_ASSISTANT_ID"
        )
        logger.info(f"classifier={CLASSIFY_ASSISTANT_ID} extractor={EXTRACT_ASSISTANT_ID}")
    except Exception as e:
        logger.error(f"Failed to ensure assistants: {e}")
        CLASSIFY_ASSISTANT_ID = None
        EXTRACT_ASSISTANT_ID = None

@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    logger.info("Shutdown event triggered")
    # No thread pool to clean up - threads are deleted immediately after use

logger.info("=== SERVER STARTUP ===")
logger.info(f"OpenAI API Key configured: {'Yes' if OPENAI_API_KEY else 'No'}")
logger.info(f"Allowed origins: {ALLOWED_ORIGINS or ['*']}")
logger.info(f"Max concurrency: {MAX_CONCURRENCY}")
logger.info(f"Models: Classify={MODEL_CLASSIFY}, Extract={MODEL_EXTRACT}")
logger.info("=== SERVER READY ===")

def b64_png_from_page(page: "fitz.Page", dpi: int = RENDER_DPI, page_index: int = 0) -> str:
    """Convert a PyMuPDF page to base64 PNG with size optimization and save to images folder"""
    mat = fitz.Matrix(dpi/72, dpi/72)
    # Try grayscale first for smaller size
    pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY, alpha=False)
    data = pix.tobytes("png")
    # If still too large, try lower DPI
    if len(data) > 15_000_000:  # 15MB limit
        logger.warning(f"Image too large ({len(data)} bytes), trying lower DPI")
        for lower_dpi in [140, 110, 92]:
            mat = fitz.Matrix(lower_dpi/72, lower_dpi/72)
            pix = page.get_pixmap(matrix=mat, colorspace=fitz.csGRAY, alpha=False)
            data = pix.tobytes("png")
            if len(data) <= 15_000_000:
                logger.info(f"Successfully reduced image size with DPI {lower_dpi}")
                break
    # Save image to images folder
    os.makedirs("images", exist_ok=True)
    image_filename = f"images/page_{page_index}_{int(time.time())}.png"
    with open(image_filename, 'wb') as f:
        f.write(data)
    logger.info(f"Image saved to {image_filename}")
    b64_data = base64.b64encode(data).decode("ascii")
    # Log image size for debugging
    logger.info(f"Generated image: {len(data)} bytes, base64: {len(b64_data)} characters")
    return b64_data

async def create_openai_assistant(name: str, instructions: str, model: str) -> str:
    """Create an OpenAI assistant and return the assistant ID"""
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2"
        }
        payload = {
            "name": name,
            "instructions": instructions,
            "model": model
        }
        # Retry wrapper for Assistants API calls
        for attempt in range(RETRY_MAX):
            try:
                async with session.post(
                    "https://api.openai.com/v1/assistants",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status in (200, 201):
                        result = await response.json()
                        return result["id"]
                    elif response.status in [429, 500, 502, 503, 504]:
                        if attempt < RETRY_MAX - 1:
                            delay = RETRY_BASE_DELAY * (2 ** attempt)
                            logger.warning(f"Assistant creation attempt {attempt + 1} failed with {response.status}, retrying in {delay}s...")
                            await asyncio.sleep(delay)
                            continue
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to create assistant {name}: {response.status} - {error_text}")
                        raise HTTPException(status_code=502, detail=f"Failed to create assistant: {error_text}")
            except Exception as e:
                if attempt < RETRY_MAX - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"Assistant creation attempt {attempt + 1} failed with {e}, retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise HTTPException(status_code=502, detail=f"Failed to create assistant after {RETRY_MAX} attempts: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to create assistant after {RETRY_MAX} attempts")

async def create_openai_thread(metadata: Optional[Dict[str, str]] = None) -> str:
    """Create a new OpenAI thread and return the thread ID"""
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2"
        }
        payload = {}
        if metadata:
            payload["metadata"] = metadata
        # Retry wrapper for thread creation
        for attempt in range(RETRY_MAX):
            try:
                async with session.post(
                    "https://api.openai.com/v1/threads",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status in (200, 201):
                        result = await response.json()
                        return result["id"]
                    elif response.status in [429, 500, 502, 503, 504]:
                        if attempt < RETRY_MAX - 1:
                            delay = RETRY_BASE_DELAY * (2 ** attempt)
                            logger.warning(f"Thread creation attempt {attempt + 1} failed with {response.status}, retrying in {delay}s...")
                            await asyncio.sleep(delay)
                            continue
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to create thread: {response.status} - {error_text}")
                        raise HTTPException(status_code=502, detail=f"Failed to create thread: {error_text}")
            except Exception as e:
                if attempt < RETRY_MAX - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"Thread creation attempt {attempt + 1} failed with {e}, retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    raise HTTPException(status_code=502, detail=f"Failed to create thread after {RETRY_MAX} attempts: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to create thread after {RETRY_MAX} attempts")

async def _delete_openai_file(session: aiohttp.ClientSession, file_id: str):
    headers = {"Authorization": f"Bearer {OPENAI_API_KEY}"}
    async with session.delete(f"https://api.openai.com/v1/files/{file_id}", headers=headers) as resp:
        if resp.status not in (200, 404):
            logger.warning(f"Failed to delete file {file_id}: {resp.status} - {await resp.text()}")

async def _delete_files_for_thread(thread_id: str):
    if not FILES_BY_THREAD.get(thread_id):
        return
    async with aiohttp.ClientSession() as session:
        for fid in FILES_BY_THREAD[thread_id]:
            try:
                await _delete_openai_file(session, fid)
            except Exception as e:
                logger.warning(f"Error deleting file {fid}: {e}")
    del FILES_BY_THREAD[thread_id]

async def run_thread_with_assistant(thread_id: str, assistant_id: str, stream: bool = False, step_name: str = "unknown") -> Dict[str, Any]:
    """Run a thread with an assistant and return the assistant's JSON response for this run."""
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2"
        }

        # 1) Create run (with retries) — force JSON + temp=0
        payload = {
            "assistant_id": assistant_id,
            "response_format": {"type": "json_object"},
            "temperature": 0
        }
        for attempt in range(RETRY_MAX):
            try:
                async with session.post(
                    f"https://api.openai.com/v1/threads/{thread_id}/runs",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status in (200, 201):
                        result = await response.json()
                        run_id = result["id"]
                        break
                    elif response.status in [429, 500, 502, 503, 504] and attempt < RETRY_MAX - 1:
                        delay = RETRY_BASE_DELAY * (2 ** attempt)
                        logger.warning(f"Run creation attempt {attempt + 1} got {response.status}, retrying in {delay}s...")
                        await asyncio.sleep(delay)
                        continue
                    else:
                        error_text = await response.text()
                        logger.error(f"Failed to create run for thread {thread_id}: {response.status} - {error_text}")
                        raise HTTPException(status_code=502, detail=f"Failed to run thread: {error_text}")
            except Exception as e:
                if attempt < RETRY_MAX - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"Run creation attempt {attempt + 1} raised {e}, retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                raise HTTPException(status_code=502, detail=f"Failed to create run after {RETRY_MAX} attempts: {e}")
        else:
            raise HTTPException(status_code=502, detail=f"Failed to create run after {RETRY_MAX} attempts")

        # 2) Poll for completion (break outer loop when completed)
        delay = 0.1
        max_delay = 2.0
        completed = False
        while True:
            for attempt in range(RETRY_MAX):
                try:
                    async with session.get(
                        f"https://api.openai.com/v1/threads/{thread_id}/runs/{run_id}",
                        headers=headers
                    ) as status_response:
                        if status_response.status == 200:
                            status_result = await status_response.json()
                            status = status_result.get("status", "")
                            if status == "completed":
                                completed = True
                                break  # break retry loop
                            elif status in ["failed", "cancelled", "expired"]:
                                raise HTTPException(status_code=502, detail=f"Run {status}: {status_result.get('last_error', {})}")
                            await asyncio.sleep(delay)
                            delay = min(delay * 1.5, max_delay)
                            break  # break retry loop to re-enter outer while and poll again
                        elif status_response.status in [429, 500, 502, 503, 504] and attempt < RETRY_MAX - 1:
                            retry_delay = RETRY_BASE_DELAY * (2 ** attempt)
                            logger.warning(f"Status check attempt {attempt + 1} got {status_response.status}, retrying in {retry_delay}s...")
                            await asyncio.sleep(retry_delay)
                            continue
                        else:
                            error_text = await status_response.text()
                            logger.error(f"Failed to check run status: {status_response.status} - {error_text}")
                            raise HTTPException(status_code=502, detail=f"Failed to check run status: {error_text}")
                except Exception as e:
                    if attempt < RETRY_MAX - 1:
                        retry_delay = RETRY_BASE_DELAY * (2 ** attempt)
                        logger.warning(f"Status check attempt {attempt + 1} raised {e}, retrying in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        continue
                    raise HTTPException(status_code=502, detail=f"Failed to check run status after {RETRY_MAX} attempts: {e}")
            else:
                raise HTTPException(status_code=502, detail=f"Failed to check run status after {RETRY_MAX} attempts")
            if completed:
                break

        # 3) Fetch messages (with retries)
        for attempt in range(RETRY_MAX):
            try:
                async with session.get(
                    f"https://api.openai.com/v1/threads/{thread_id}/messages",
                    headers=headers
                ) as messages_response:
                    if messages_response.status == 200:
                        messages_result = await messages_response.json()
                        break
                    elif messages_response.status in [429, 500, 502, 503, 504] and attempt < RETRY_MAX - 1:
                        retry_delay = RETRY_BASE_DELAY * (2 ** attempt)
                        logger.warning(f"Message retrieval attempt {attempt + 1} got {messages_response.status}, retrying in {retry_delay}s...")
                        await asyncio.sleep(retry_delay)
                        continue
                    else:
                        error_text = await messages_response.text()
                        logger.error(f"Failed to get messages: {messages_response.status} - {error_text}")
                        raise HTTPException(status_code=502, detail=f"Failed to get messages: {error_text}")
            except Exception as e:
                if attempt < RETRY_MAX - 1:
                    retry_delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"Message retrieval attempt {attempt + 1} raised {e}, retrying in {retry_delay}s...")
                    await asyncio.sleep(retry_delay)
                    continue
                raise HTTPException(status_code=502, detail=f"Failed to get messages after {RETRY_MAX} attempts: {e}")
        else:
            raise HTTPException(status_code=502, detail=f"Failed to get messages after {RETRY_MAX} attempts")

        # 4) Find the assistant's response for this specific run
        messages = messages_result["data"]
        messages.sort(key=lambda m: m["created_at"], reverse=True)

        raw_responses = []
        for message in messages:
            if message["role"] == "assistant" and message.get("run_id") == run_id:
                content_blocks = message.get("content", [])
                for block in content_blocks:
                    if block.get("type") == "output_text":
                        content = block["text"]["value"]
                    elif block.get("type") == "text":
                        content = block["text"]["value"]
                    else:
                        continue
                    raw_responses.append({
                        "block_type": block.get("type"),
                        "content": content,
                        "timestamp": message.get("created_at"),
                        "run_id": run_id
                    })
                    try:
                        return json.loads(content)
                    except json.JSONDecodeError:
                        cleaned = content.strip().lstrip("\ufeff")
                        try:
                            return json.loads(cleaned)
                        except Exception:
                            # Try to extract JSON from markdown code blocks
                            import re
                            json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
                            if json_match:
                                try:
                                    return json.loads(json_match.group(1))
                                except json.JSONDecodeError as e:
                                    logger.warning(f"JSON decode error after extracting from markdown for run {run_id}: {e}")
                                    logger.warning(f"Extracted content: {json_match.group(1)[:500]}...")
                            else:
                                logger.warning(f"No JSON found in markdown for run {run_id}")
                                logger.warning(f"Raw content: {content[:500]}...")
                        continue

        # Save all raw responses to file for debugging
        if raw_responses:
            os.makedirs("responses_sample", exist_ok=True)
            debug_file = f"responses_sample/openai_{step_name}_response_{run_id}_{int(time.time())}.txt"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(f"Run ID: {run_id}\n")
                f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write("=" * 50 + "\n\n")
                for i, resp in enumerate(raw_responses):
                    f.write(f"Response {i+1}:\n")
                    f.write(f"Block Type: {resp['block_type']}\n")
                    f.write(f"Timestamp: {resp['timestamp']}\n")
                    f.write(f"Content:\n{resp['content']}\n")
                    f.write("-" * 30 + "\n\n")
            logger.info(f"Raw OpenAI response saved to {debug_file}")

        raise HTTPException(status_code=502, detail="No valid JSON response found for this run")

async def delete_thread(thread_id: str) -> None:
    """Delete a thread to free up resources (also delete any uploaded files)."""
    if not thread_id:
        return

    # delete files first
    try:
        await _delete_files_for_thread(thread_id)
    except Exception as e:
        logger.warning(f"File cleanup failed for thread {thread_id}: {e}")

    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "OpenAI-Beta": "assistants=v2"
        }
        for attempt in range(RETRY_MAX):
            try:
                async with session.delete(
                    f"https://api.openai.com/v1/threads/{thread_id}",
                    headers=headers
                ) as response:
                    if response.status in [200, 404]:
                        return
                    elif response.status in [429, 500, 502, 503, 504]:
                        if attempt < RETRY_MAX - 1:
                            delay = RETRY_BASE_DELAY * (2 ** attempt)
                            logger.warning(f"Thread deletion attempt {attempt + 1} failed with {response.status}, retrying in {delay}s...")
                            await asyncio.sleep(delay)
                            continue
                    else:
                        error_text = await response.text()
                        logger.warning(f"Failed to delete thread {thread_id}: {response.status} - {error_text}")
                        return
            except Exception as e:
                if attempt < RETRY_MAX - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"Thread deletion attempt {attempt + 1} failed with {e}, retrying in {delay}s...")
                    await asyncio.sleep(delay)
                    continue
                else:
                    logger.warning(f"Failed to delete thread {thread_id} after {RETRY_MAX} attempts: {e}")
                    return

async def openai_json_response(model: str, system_prompt: str, user_parts: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Chat Completions + JSON mode, supports image inputs.
    'user_parts' is a list like:
      [{"type":"input_text","text":"..."}, {"type":"input_image","image_url":"data:image/png;base64,..."}]
    """
    logger.info(f"OpenAI API call - Model: {model}, User parts: {len(user_parts)}")
    last_err = None

    # Convert our "responses-style" parts -> chat "content" parts
    def _chat_content_from_parts(parts: List[Dict[str, Any]]):
        out = []
        for p in parts:
            t = p.get("type")
            if t in ("input_text", "text"):
                out.append({"type": "text", "text": p.get("text", "")})
            elif t in ("input_image", "image_url"):
                url = p.get("image_url")
                if isinstance(url, str):
                    out.append({"type": "image_url", "image_url": {"url": url}})
                elif isinstance(url, dict):
                    out.append({"type": "image_url", "image_url": {"url": url.get("url", "")}})
        return out

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": _chat_content_from_parts(user_parts)},
    ]

    for attempt in range(1, RETRY_MAX + 1):
        try:
            logger.info(f"OpenAI attempt {attempt}/{RETRY_MAX}")
            async with sem:
                resp = await aclient.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0,
                    response_format={"type": "json_object"},
                    timeout=OPENAI_TIMEOUT_S,
                )
            text = resp.choices[0].message.content
            if not text:
                logger.warning("Empty response from OpenAI, using fallback")
                text = json.dumps({"error": "empty_output"})
            # Save raw response for debugging
            os.makedirs("responses_sample", exist_ok=True)
            debug_file = f"responses_sample/openai_chat_response_{int(time.time())}.txt"
            with open(debug_file, 'w', encoding='utf-8') as f:
                f.write(f"Model: {model}\n")
                f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"System Prompt: {system_prompt}\n")
                f.write("=" * 50 + "\n\n")
                f.write(f"Raw Response:\n{text}\n")
            logger.info(f"Raw OpenAI chat response saved to {debug_file}")
            try:
                result = json.loads(text)
                logger.info(f"OpenAI response received: {result}")
                return result
            except json.JSONDecodeError:
                # Try BOM/whitespace strip
                cleaned = text.strip().lstrip("\ufeff")
                try:
                    result = json.loads(cleaned)
                    logger.info("OpenAI response received (cleaned): OK")
                    return result
                except json.JSONDecodeError:
                    # Try to extract JSON from markdown code blocks
                    import re
                    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', text, re.DOTALL)
                    if json_match:
                        try:
                            result = json.loads(json_match.group(1))
                            logger.info(f"OpenAI response received (extracted from markdown): {result}")
                            return result
                        except json.JSONDecodeError as e:
                            logger.error(f"JSON decode error after extracting from markdown: {e}")
                            logger.error(f"Extracted content: {json_match.group(1)[:500]}...")
                            raise
                    else:
                        logger.error(f"No JSON found in markdown response")
                        logger.error(f"Raw content: {text[:500]}...")
                        raise
        except Exception as e:
            logger.error(f"OpenAI attempt {attempt} failed: {e}")
            os.makedirs("responses_sample", exist_ok=True)
            error_file = f"responses_sample/openai_error_{int(time.time())}.txt"
            with open(error_file, 'w', encoding='utf-8') as f:
                f.write(f"Model: {model}\n")
                f.write(f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
                f.write(f"Attempt: {attempt}/{RETRY_MAX}\n")
                f.write(f"Error: {str(e)}\n")
                f.write(f"System Prompt: {system_prompt}\n")
                f.write("=" * 50 + "\n\n")
                f.write(f"User Parts: {json.dumps(user_parts, indent=2)}\n")
            logger.info(f"OpenAI error details saved to {error_file}")
            last_err = e
            await asyncio.sleep(RETRY_BASE_DELAY * (2 ** (attempt - 1)))

    logger.error(f"All OpenAI attempts failed: {last_err}")
    raise HTTPException(status_code=502, detail=f"OpenAI call failed: {last_err}")

async def process_page_with_thread(page_index: int, b64_image: str) -> tuple[PageResult, Dict[str, Any]]:
    """Process a single page using proper two-step workflow: classification then extraction"""
    if not CLASSIFY_ASSISTANT_ID or not EXTRACT_ASSISTANT_ID:
        logger.error(f"Assistants not available for page {page_index}")
        page_result = PageResult(
            page_index=page_index,
            doc_type="Unknown",
            confidence=0.0,
            brief_summary=None,
            key_hints=None
        )
        return page_result, {}

    thread_id = None
    try:
        logger.info(f"Processing page {page_index} with single-thread method (classification + extraction)")
        # Create a new thread for this page
        thread_id = await create_openai_thread({
            "purpose": "page_processing",
            "page_index": str(page_index),
            "created_at": str(int(time.time()))
        })
        logger.info(f"Created thread {thread_id} for page {page_index}")

        image_url = f"data:image/png;base64,{b64_image}"
        safe_len = len(image_url)
        logger.info(f"Image URL length: {safe_len if safe_len < 2000 else '>=2000 chars'}")

        # Apply concurrency control around all Assistant API calls
        async with sem:
            # Step 1: Classification
            classification_prompt = PROMPTS["classification"]["content"]
            await send_message_to_thread(thread_id, classification_prompt, image_url)
            logger.info(f"Classification message sent to thread {thread_id} for page {page_index}")

            classification_result = await run_thread_with_assistant(thread_id, CLASSIFY_ASSISTANT_ID, step_name="classification")
            logger.info(f"Classification result for page {page_index}: {classification_result}")

            # Step 2: Schema for classified type
            doc_type = classification_result.get("doc_type", "Unknown")
            if doc_type not in TYPE_ORDER:
                doc_type = "Unknown"

            schema = get_document_schema(doc_type, STRUCTURE_SCHEMA)
            if not schema:
                logger.warning(f"No schema found for {doc_type}, using basic extraction")
                schema = {}

            # Step 3: Extraction prompt (no re-send image; thread already has it)
            extraction_prompt = f"""{PROMPTS["extraction"]["content"]}

Document type: {doc_type}
Return STRICT JSON exactly as per this schema (set null if unknown):
{json.dumps(schema, indent=2)}

IMPORTANT:
- Fill "pages_used" with the list of page indices you actually referenced.
- Follow the schema structure exactly.
- Use null for missing fields, not empty strings or arrays.
- Output ONLY the JSON object, no prose, no markdown."""
            await send_message_to_thread(thread_id, extraction_prompt)
            logger.info(f"Extraction message sent to thread {thread_id} for page {page_index}")

            extraction_result = await run_thread_with_assistant(thread_id, EXTRACT_ASSISTANT_ID, step_name="extraction")
            logger.info(f"Extraction result for page {page_index}: {extraction_result}")

        classification_data = classification_result
        extraction_data = extraction_result

        # Validate and create PageResult
        try:
            conf = float(classification_data.get("confidence", 0.0))
        except Exception:
            conf = 0.0
        conf = max(0.0, min(1.0, conf))

        page_result = PageResult(
            page_index=int(classification_data.get("page_index", page_index)),
            doc_type=doc_type,
            confidence=conf,
            brief_summary=None,
            key_hints=None
        )
        # Add pages_used
        if isinstance(extraction_data, dict):
            extraction_data["pages_used"] = [page_index]

        logger.info(f"Successfully processed page {page_index} with thread {thread_id}")
        return page_result, extraction_data

    except Exception as e:
        logger.error(f"Thread-based processing failed for page {page_index}: {e}")
        page_result = PageResult(
            page_index=page_index,
            doc_type="Unknown",
            confidence=0.0,
            brief_summary=None,
            key_hints=None
        )
        return page_result, {}
    finally:
        if thread_id:
            await delete_thread(thread_id)

async def classify_pages(b64_images: List[str]) -> List[PageResult]:
    async def _one(i: int) -> PageResult:
        user_parts = [
            {"type": "input_text", "text": json.dumps({"page_index": i})},
            {"type": "input_image", "image_url": f"data:image/png;base64,{b64_images[i]}"},
        ]
        obj = await openai_json_response(MODEL_CLASSIFY, PROMPTS["classification"]["content"], user_parts)
        doc_type = obj.get("doc_type") if isinstance(obj, dict) else None
        if doc_type not in TYPE_ORDER:
            doc_type = "Unknown"
        try:
            conf = float(obj.get("confidence", 0.0))
        except Exception:
            conf = 0.0
        conf = max(0.0, min(1.0, conf))
        return PageResult(
            page_index=int(obj.get("page_index", i) or i),
            doc_type=doc_type,
            confidence=conf,
            brief_summary=obj.get("brief_summary"),
            key_hints=obj.get("key_hints"),
        )
    return await asyncio.gather(*[asyncio.create_task(_one(i)) for i in range(len(b64_images))])

def chunk_consecutive_by_type(pages: List[Dict[str, Any]]) -> Dict[str, List[List[int]]]:
    groups: Dict[str, List[List[int]]] = {}
    if not pages: return groups
    cur_type = pages[0]["doc_type"]; cur_chunk = [pages[0]["page_index"]]
    for p in pages[1:]:
        if p["doc_type"] == cur_type:
            cur_chunk.append(p["page_index"])
        else:
            groups.setdefault(cur_type, []).append(cur_chunk)
            cur_type = p["doc_type"]; cur_chunk = [p["page_index"]]
    groups.setdefault(cur_type, []).append(cur_chunk)
    return groups

def make_user_parts_for_pages(page_indices: List[int], b64_images: List[str], extra_text: str = "") -> List[Dict[str, Any]]:
    parts: List[Dict[str, Any]] = []
    if extra_text:
        parts.append({"type": "input_text", "text": extra_text})
    for idx in page_indices:
        parts.append({"type": "input_text", "text": f"page_index: {idx}"})
        parts.append({"type": "input_image", "image_url": f"data:image/png;base64,{b64_images[idx]}"})
    return parts

async def extract_for_group(doc_type: str, page_spans: List[List[int]], b64_images: List[str]) -> Dict[str, Any]:
    # Get the schema for this document type from structure.json
    schema = get_document_schema(doc_type, STRUCTURE_SCHEMA)
    if not schema:
        logger.warning(f"No schema found for document type: {doc_type}, using fallback")
        return {"document_type": "Unknown", "pages_used": [i for span in page_spans for i in span]}

    pages_flat = [i for span in page_spans for i in span]
    logger.info(f"Extracting {doc_type} with schema containing {len(json.dumps(schema))} characters")

    user_intro = f"""Document type: {doc_type}
Return STRICT JSON exactly as per this schema (set null if unknown):
{json.dumps(schema, indent=2)}

IMPORTANT:
- Consider ALL provided pages as the same document.
- Fill "pages_used" with the list of page indices you actually referenced.
- Follow the schema structure exactly.
- Use null for missing fields, not empty strings or arrays.
"""
    parts = make_user_parts_for_pages(pages_flat, b64_images, extra_text=user_intro)
    obj = await openai_json_response(MODEL_EXTRACT, PROMPTS["extraction"]["content"], parts)
    if isinstance(obj, dict) and "pages_used" not in obj:
        try: obj["pages_used"] = pages_flat
        except Exception: pass
    return obj

@app.post("/ocr-stream")
async def ocr_stream_endpoint(file: UploadFile = File(...), threadId: str = Form(None), userId: str = Form(None)):
    """Streaming OCR endpoint that sends results as each page is processed"""
    logger.info(f"=== STREAMING OCR REQUEST STARTED ===")
    logger.info(f"File: {file.filename}, Size: {file.size if hasattr(file, 'size') else 'unknown'}")
    logger.info(f"Thread ID: {threadId}, User ID: {userId}")

    if not file.filename.lower().endswith(".pdf"):
        logger.error(f"Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    pdf_bytes = await file.read()
    logger.info(f"PDF bytes read: {len(pdf_bytes)} bytes")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        logger.info(f"PDF opened successfully, pages: {len(doc)}")
    except Exception as e:
        logger.error(f"Failed to open PDF: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

    t0 = time.time()
    logger.info("Starting page rendering...")
    b64_images: List[str] = [b64_png_from_page(p, page_index=i) for i, p in enumerate(doc)]
    doc.close()
    t_render = time.time()
    logger.info(f"Page rendering completed in {int((t_render - t0) * 1000)}ms, {len(b64_images)} images generated")

    async def generate_stream():
        try:
            # Send initial metadata
            yield f"data: {json.dumps({'type': 'start', 'total_pages': len(b64_images)})}\n\n"
            
            # Create a queue to collect results as they complete
            import asyncio
            from collections import defaultdict
            
            results_queue = asyncio.Queue()
            page_results = [None] * len(b64_images)
            extraction_data_per_page = [None] * len(b64_images)
            completed_pages = 0
            
            async def process_single_page(page_index: int, b64_image: str):
                """Process a single page and put result in queue"""
                try:
                    page_result, extraction_data = await process_page_with_thread(page_index, b64_image)
                    await results_queue.put({
                        'type': 'page_result',
                        'page_index': page_index,
                        'page_result': page_result,
                        'extraction_data': extraction_data
                    })
                except Exception as e:
                    logger.error(f"Error processing page {page_index}: {e}")
                    await results_queue.put({
                        'type': 'page_error',
                        'page_index': page_index,
                        'error': str(e)
                    })
            
            # Start all page processing tasks concurrently
            tasks = [
                asyncio.create_task(process_single_page(i, b64_images[i]))
                for i in range(len(b64_images))
            ]
            
            # Process results as they complete
            while completed_pages < len(b64_images):
                try:
                    # Wait for next result with timeout
                    result = await asyncio.wait_for(results_queue.get(), timeout=1.0)
                    completed_pages += 1
                    
                    if result['type'] == 'page_result':
                        page_index = result['page_index']
                        page_results[page_index] = result['page_result']
                        extraction_data_per_page[page_index] = result['extraction_data']
                        
                        # Send page result immediately
                        page_data = {
                            'type': 'page_result',
                            'page_index': page_index,
                            'page_result': result['page_result'].dict(),
                            'extraction_data': result['extraction_data']
                        }
                        yield f"data: {json.dumps(page_data)}\n\n"
                        
                    elif result['type'] == 'page_error':
                        # Send error for this page
                        error_data = {
                            'type': 'page_error',
                            'page_index': result['page_index'],
                            'error': result['error']
                        }
                        yield f"data: {json.dumps(error_data)}\n\n"
                        
                except asyncio.TimeoutError:
                    # No result available yet, continue waiting
                    continue
            
            # Wait for all tasks to complete
            await asyncio.gather(*tasks, return_exceptions=True)
            
            # Send completion signal
            successful_pages = sum(1 for r in page_results if r is not None)
            completion_data = {
                'type': 'complete',
                'total_pages': len(b64_images),
                'processed_pages': successful_pages
            }
            yield f"data: {json.dumps(completion_data)}\n\n"
            
        except Exception as e:
            logger.error(f"Streaming error: {e}")
            error_data = {
                'type': 'error',
                'error': str(e)
            }
            yield f"data: {json.dumps(error_data)}\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST",
            "Access-Control-Allow-Headers": "Content-Type",
        }
    )

@app.post("/ocr", response_model=OCRResponse)
async def ocr_endpoint(file: UploadFile = File(...)):
    logger.info(f"=== OCR REQUEST STARTED ===")
    logger.info(f"File: {file.filename}, Size: {file.size if hasattr(file, 'size') else 'unknown'}")

    if not file.filename.lower().endswith(".pdf"):
        logger.error(f"Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    pdf_bytes = await file.read()
    logger.info(f"PDF bytes read: {len(pdf_bytes)} bytes")

    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        logger.info(f"PDF opened successfully, pages: {len(doc)}")
    except Exception as e:
        logger.error(f"Failed to open PDF: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid PDF: {e}")

    t0 = time.time()
    logger.info("Starting page rendering...")
    b64_images: List[str] = [b64_png_from_page(p, page_index=i) for i, p in enumerate(doc)]
    doc.close()
    t_render = time.time()
    logger.info(f"Page rendering completed in {int((t_render - t0) * 1000)}ms, {len(b64_images)} images generated")

    logger.info("Starting optimized single-thread processing (classification + extraction per page)...")
    # Step 1: Process all pages in parallel
    page_tasks = [asyncio.create_task(
        process_page_with_thread(i, b64_images[i])
    ) for i in range(len(b64_images))]

    page_results_with_extraction = await asyncio.gather(*page_tasks)
    page_results = [result[0] for result in page_results_with_extraction]
    extraction_data_per_page = [result[1] for result in page_results_with_extraction]

    t_process = time.time()
    logger.info(f"Page processing completed in {int((t_process - t_render) * 1000)}ms")
    logger.info(f"Processing results: {[{'page': pr.page_index, 'type': pr.doc_type, 'confidence': pr.confidence} for pr in page_results]}")

    # Step 2: Group pages by document type and combine extraction data
    grouped_spans = chunk_consecutive_by_type([pr.dict() for pr in page_results])
    logger.info(f"Grouped spans: {grouped_spans}")

    # Step 3: Combine extraction data for each document group
    logger.info("Combining extraction data for each document group...")
    grouped_results = []

    for doc_type, spans in grouped_spans.items():
        if spans and spans[0]:
            pages_flat = [i for span in spans for i in span]
            combined_extraction_data = {}
            for page_idx in pages_flat:
                if page_idx < len(extraction_data_per_page) and extraction_data_per_page[page_idx]:
                    page_data = extraction_data_per_page[page_idx]
                    for key, value in page_data.items():
                        if key not in combined_extraction_data:
                            combined_extraction_data[key] = value
                        elif isinstance(value, list) and isinstance(combined_extraction_data[key], list):
                            combined_extraction_data[key].extend(value)
                        elif value is not None and combined_extraction_data[key] is None:
                            combined_extraction_data[key] = value
            combined_extraction_data["pages_used"] = pages_flat
            grouped_results.append(ExtractedGroup(
                doc_type=doc_type,
                page_spans=spans,
                data=combined_extraction_data
            ))

    t_extract = time.time()
    logger.info(f"Data combination completed in {int((t_extract - t_process) * 1000)}ms")

    final_response = OCRResponse(
        num_pages=len(b64_images),
        page_results=page_results,
        grouped_results=grouped_results,
        timings_ms={
            "render_ms": int((t_render - t0) * 1000),
            "process_ms": int((t_process - t_render) * 1000),
            "combine_ms": int((t_extract - t_process) * 1000),
            "total_ms": int((t_extract - t0) * 1000),
        },
    )

    logger.info(f"=== FINAL RESPONSE ===")
    logger.info(f"Total pages: {final_response.num_pages}")
    logger.info(f"Timings: {final_response.timings_ms}")
    logger.info(f"Page results count: {len(final_response.page_results)}")
    logger.info(f"Grouped results count: {len(final_response.grouped_results)}")

    response_dict = final_response.dict()
    with open('ocr_response.json', 'w') as f:
        json.dump(response_dict, f, indent=2, default=str)
    logger.info("Full response saved to ocr_response.json")

    logger.info(f"=== OCR REQUEST COMPLETED ===")
    return JSONResponse(content=response_dict)

# Minimal streamed chat (SSE) that you can wire to the UI
@app.post("/chat")
async def chat(req: Request):
    logger.info("=== CHAT REQUEST STARTED ===")
    body = await req.json()
    user_msg = body.get("message", "")
    thread_id = body.get("threadId", "")
    user_id = body.get("userId", "")
    
    logger.info(f"Chat message received: {user_msg}")
    logger.info(f"Thread ID: {thread_id}, User ID: {user_id}")

    async def token_stream():
        try:
            logger.info("Sending initial response...")
            yield "data: " + json.dumps({"role": "assistant", "content": "Thinking about your bill..."}) + "\n\n"
            await asyncio.sleep(0.2)
            logger.info("Sending main response...")
            yield "data: " + json.dumps({"role": "assistant", "content": f"Got it: {user_msg}\n\nI can help you with bill processing, document analysis, and data extraction. Upload a PDF file or ask me questions about your documents!"}) + "\n\n"
            logger.info("Sending completion signal...")
            yield "data: [DONE]\n\n"
            logger.info("=== CHAT REQUEST COMPLETED ===")
        except Exception as e:
            logger.error(f"Error in chat stream: {e}")
            yield "data: " + json.dumps({"role": "assistant", "content": "Sorry, there was an error processing your request."}) + "\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        token_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )

@app.get("/health")
async def health_check():
    logger.info("Health check requested")
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/ocr/stream")
async def ocr_stream_endpoint(file: UploadFile = File(...)):
    """Streaming OCR endpoint for real-time processing updates"""
    logger.info(f"=== STREAMING OCR REQUEST STARTED ===")
    logger.info(f"File: {file.filename}, Size: {file.size if hasattr(file, 'size') else 'unknown'}")

    if not file.filename.lower().endswith(".pdf"):
        logger.error(f"Invalid file type: {file.filename}")
        raise HTTPException(status_code=400, detail="Please upload a PDF file.")

    async def generate_stream():
        try:
            yield f"data: {json.dumps({'type': 'status', 'message': 'Processing started...'})}\n\n"
            pdf_bytes = await file.read()
            logger.info(f"PDF bytes read: {len(pdf_bytes)} bytes")
            try:
                doc = fitz.open(stream=pdf_bytes, filetype="pdf")
                logger.info(f"PDF opened successfully, pages: {len(doc)}")
            except Exception as e:
                logger.error(f"Failed to open PDF: {e}")
                yield f"data: {json.dumps({'type': 'error', 'message': f'Invalid PDF: {e}'})}\n\n"
                return

            t0 = time.time()
            yield f"data: {json.dumps({'type': 'status', 'message': 'Rendering pages...'})}\n\n"
            b64_images: List[str] = [b64_png_from_page(p, page_index=i) for i, p in enumerate(doc)]
            doc.close()
            t_render = time.time()
            yield f"data: {json.dumps({'type': 'progress', 'stage': 'render', 'duration_ms': int((t_render - t0) * 1000), 'pages': len(b64_images)})}\n\n"

            yield f"data: {json.dumps({'type': 'status', 'message': 'Processing pages...'})}\n\n"

            page_results = []
            extraction_data_per_page = []
            for i, b64_image in enumerate(b64_images):
                page_result, extraction_data = await process_page_with_thread(i, b64_image)
                page_results.append(page_result)
                extraction_data_per_page.append(extraction_data)
                yield f"data: {json.dumps({'type': 'progress', 'stage': 'process', 'page': i, 'doc_type': page_result.doc_type, 'confidence': page_result.confidence})}\n\n"

            t_classify = time.time()
            yield f"data: {json.dumps({'type': 'progress', 'stage': 'classify_complete', 'duration_ms': int((t_classify - t_render) * 1000)})}\n\n"

            grouped_spans = chunk_consecutive_by_type([pr.dict() for pr in page_results])
            yield f"data: {json.dumps({'type': 'status', 'message': f'Found {len(grouped_spans)} document groups'})}\n\n"

            yield f"data: {json.dumps({'type': 'status', 'message': 'Combining extraction data...'})}\n\n"

            grouped_results = []
            for doc_type, spans in grouped_spans.items():
                if spans and spans[0]:
                    pages_flat = [i for span in spans for i in span]
                    combined_extraction_data = {}
                    for page_idx in pages_flat:
                        if page_idx < len(extraction_data_per_page) and extraction_data_per_page[page_idx]:
                            page_data = extraction_data_per_page[page_idx]
                            for key, value in page_data.items():
                                if key not in combined_extraction_data:
                                    combined_extraction_data[key] = value
                                elif isinstance(value, list) and isinstance(combined_extraction_data[key], list):
                                    combined_extraction_data[key].extend(value)
                                elif value is not None and combined_extraction_data[key] is None:
                                    combined_extraction_data[key] = value
                    combined_extraction_data["pages_used"] = pages_flat
                    grouped_results.append(ExtractedGroup(
                        doc_type=doc_type,
                        page_spans=spans,
                        data=combined_extraction_data
                    ))
                    yield f"data: {json.dumps({'type': 'progress', 'stage': 'combine', 'doc_type': doc_type, 'pages': pages_flat})}\n\n"

            t_extract = time.time()

            final_response = OCRResponse(
                num_pages=len(b64_images),
                page_results=page_results,
                grouped_results=grouped_results,
                timings_ms={
                    "render_ms": int((t_render - t0) * 1000),
                    "classify_ms": int((t_classify - t_render) * 1000),
                    "extract_ms": int((t_extract - t_classify) * 1000),
                    "total_ms": int((t_extract - t0) * 1000),
                },
            )

            logger.info(f"About to send completion event with {len(grouped_results)} grouped results")
            yield f"data: {json.dumps({'type': 'complete', 'data': final_response.dict()})}\n\n"
            yield f"data: [DONE]\n\n"
            logger.info(f"=== STREAMING OCR REQUEST COMPLETED ===")

        except Exception as e:
            logger.error(f"Streaming OCR error: {e}")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
            yield f"data: [DONE]\n\n"

    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/prompts")
async def get_prompts():
    """Get current prompts configuration"""
    logger.info("Prompts requested")
    return PROMPTS

@app.post("/prompts")
async def update_prompts(prompts_data: dict):
    """Update prompts configuration"""
    logger.info("Updating prompts")
    try:
        required_keys = ["classification", "extraction", "chat"]
        for key in required_keys:
            if key not in prompts_data:
                raise HTTPException(status_code=400, detail=f"Missing required prompt type: {key}")
            if "content" not in prompts_data[key]:
                raise HTTPException(status_code=400, detail=f"Missing content for prompt type: {key}")

        prompts_file = os.path.join(os.path.dirname(__file__), 'prompts.json')
        with open(prompts_file, 'w', encoding='utf-8') as f:
            json.dump(prompts_data, f, indent=2, ensure_ascii=False)

        global PROMPTS, MODEL_CLASSIFY, MODEL_EXTRACT
        PROMPTS = prompts_data
        
        # Update models from the new prompts
        MODEL_CLASSIFY = PROMPTS.get("classification", {}).get("model", "gpt-4o-2024-08-06")
        MODEL_EXTRACT = PROMPTS.get("extraction", {}).get("model", "gpt-4o-2024-08-06")
        
        logger.info(f"Prompts updated successfully. New models: Classify={MODEL_CLASSIFY}, Extract={MODEL_EXTRACT}")
        return {
            "status": "success", 
            "message": "Prompts updated successfully",
            "models": {
                "classification": MODEL_CLASSIFY,
                "extraction": MODEL_EXTRACT
            }
        }

    except Exception as e:
        logger.error(f"Error updating prompts: {e}")
        raise HTTPException(status_code=500, detail=f"Error updating prompts: {str(e)}")

async def _upload_image_data_url_get_file_id(session: aiohttp.ClientSession, data_url: str, track_thread_id: Optional[str] = None) -> str:
    """
    Upload a data:image/*;base64,... to OpenAI Files and return file_id
    """
    if not data_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Expected data URL for image upload")

    try:
        header, b64part = data_url.split(",", 1)
    except ValueError:
        raise HTTPException(status_code=400, detail="Malformed data URL")

    # Extract MIME type (e.g., image/png)
    try:
        mime = header.split(";")[0].split(":", 1)[1]
    except Exception:
        mime = "application/octet-stream"

    # Pick a reasonable filename extension from mime
    ext = "png"
    if "/" in mime:
        maybe_ext = mime.split("/", 1)[1].lower()
        if maybe_ext:
            ext = "png" if maybe_ext == "x-png" else maybe_ext

    try:
        img_bytes = base64.b64decode(b64part, validate=True)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 in data URL")

    form = aiohttp.FormData()
    # For Assistants images, "purpose" should be "vision"
    form.add_field("purpose", "vision")
    form.add_field(
        "file",
        img_bytes,
        filename=f"page.{ext}",
        content_type=mime,
    )

    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
    }

    async with session.post("https://api.openai.com/v1/files", headers=headers, data=form) as resp:
        if resp.status != 200:
            err = await resp.text()
            logger.error(f"Image upload failed: {resp.status} - {err}")
            raise HTTPException(status_code=502, detail=f"Image upload failed: {err}")
        payload = await resp.json()
        file_id = payload.get("id")
        if not file_id:
            raise HTTPException(status_code=502, detail="Image upload succeeded but no file_id returned")
        if track_thread_id:
            FILES_BY_THREAD[track_thread_id].append(file_id)
        return file_id

async def send_message_to_thread(thread_id: str, content: str, image_url: Optional[str] = None) -> str:
    """Send a message to an OpenAI thread and return the message ID (Assistants v2 compliant)."""
    async with aiohttp.ClientSession() as session:
        headers = {
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
            "OpenAI-Beta": "assistants=v2",
        }

        # MUST be 'text'
        message_content = [{"type": "text", "text": content}]

        if image_url:
            logger.info(f"Preparing image for Assistants message; url length: {len(image_url) if len(image_url) < 2000 else '>=2000 chars'}")

            if image_url.startswith("data:image/"):
                # Upload the data URL to Files and reference by file_id
                file_id = await _upload_image_data_url_get_file_id(session, image_url, track_thread_id=thread_id)
                # MUST be 'image_file'
                message_content.append({
                    "type": "image_file",
                    "image_file": {"file_id": file_id}
                })
            elif image_url.startswith("http://") or image_url.startswith("https://"):
                # MUST be 'image_url'
                message_content.append({
                    "type": "image_url",
                    "image_url": {"url": image_url}
                })
            else:
                logger.error(f"Unsupported image_url format for Assistants: {image_url[:80]}...")
                raise HTTPException(status_code=400, detail="image_url must be a data URL or http(s) URL")

        payload = {
            "role": "user",
            "content": message_content,
        }

        logger.info(f"Sending message to thread {thread_id}, text_len={len(content)}, has_image={image_url is not None}")

        for attempt in range(RETRY_MAX):
            try:
                async with session.post(
                    f"https://api.openai.com/v1/threads/{thread_id}/messages",
                    headers=headers,
                    json=payload
                ) as response:
                    if response.status in (200, 201):
                        result = await response.json()
                        return result["id"]
                    elif response.status in [429, 500, 502, 503, 504] and attempt < RETRY_MAX - 1:
                        delay = RETRY_BASE_DELAY * (2 ** attempt)
                        logger.warning(f"send_message attempt {attempt+1} got {response.status}, retrying in {delay}s")
                        await asyncio.sleep(delay)
                        continue
                    error_text = await response.text()
                    logger.error(f"Failed to send message to thread {thread_id}: {response.status} - {error_text}")
                    raise HTTPException(status_code=502, detail=f"Failed to send message: {error_text}")
            except Exception as e:
                if attempt < RETRY_MAX - 1:
                    delay = RETRY_BASE_DELAY * (2 ** attempt)
                    logger.warning(f"send_message attempt {attempt+1} raised {e}, retrying in {delay}s")
                    await asyncio.sleep(delay)
                    continue
                raise

        raise HTTPException(status_code=502, detail="Failed to send message after retries")
