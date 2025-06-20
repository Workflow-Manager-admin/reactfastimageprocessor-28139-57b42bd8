import os
import uuid
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, status, Query
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi import BackgroundTasks
from pydantic import BaseModel, Field

from PIL import Image, ImageFilter

# === Configuration ===
IMAGE_STORAGE_DIR = "images"
PROCESSED_IMAGE_DIR = "processed"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
IMAGE_STORAGE_PATH = os.path.join(PROJECT_ROOT, IMAGE_STORAGE_DIR)
PROCESSED_IMAGE_PATH = os.path.join(PROJECT_ROOT, PROCESSED_IMAGE_DIR)
ALLOWED_IMAGE_EXTENSIONS = ('.png', '.jpg', '.jpeg', '.bmp', '.gif', '.webp')

# Ensure directories exist
os.makedirs(IMAGE_STORAGE_PATH, exist_ok=True)
os.makedirs(PROCESSED_IMAGE_PATH, exist_ok=True)

app = FastAPI(
    title="Image Processing API",
    description="Backend API for uploading images, performing processing (resize, filter), and retrieving results.",
    version="1.0.0",
    openapi_tags=[
        {"name": "upload", "description": "Image upload operations"},
        {"name": "processing", "description": "Image processing (resize, filter, etc)"},
        {"name": "results", "description": "Retrieve processed images"},
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==== Pydantic Models ====

class ImageUploadResponse(BaseModel):
    image_id: str = Field(..., description="Unique ID of the uploaded image")
    filename: str = Field(..., description="Stored filename")
    message: str = Field(..., description="Success message")


class ProcessRequest(BaseModel):
    operation: str = Field(..., description="Processing operation: 'resize', 'blur', etc.")
    width: Optional[int] = Field(None, description="Target width (for resize)")
    height: Optional[int] = Field(None, description="Target height (for resize)")
    filter_type: Optional[str] = Field(None, description="Blur/Sharpen/Edge Enhancement")
    # Can be extended with more fields as needed


class ProcessResponse(BaseModel):
    processed_id: str = Field(..., description="Unique ID of the processed image")
    original_id: str = Field(..., description="ID of the original image")
    operation: str = Field(..., description="Processing performed")
    filename: str = Field(..., description="Stored filename of processed image")
    message: str = Field(..., description="Success message")


# ==== Utility Functions ====

def get_file_ext(filename: str) -> str:
    parts = os.path.splitext(filename)
    return parts[1].lower() if len(parts) > 1 else ""


def is_image_file(filename: str) -> bool:
    ext = get_file_ext(filename)
    return ext in ALLOWED_IMAGE_EXTENSIONS


def save_upload_file(upload_file: UploadFile, destination: str):
    with open(destination, "wb") as f:
        for chunk in upload_file.file:
            f.write(chunk)


def generate_unique_id() -> str:
    return str(uuid.uuid4())


def get_image_path(image_id: str, processed: bool = False) -> Optional[str]:
    base = PROCESSED_IMAGE_PATH if processed else IMAGE_STORAGE_PATH
    for filename in os.listdir(base):
        if filename.startswith(image_id):
            return os.path.join(base, filename)
    return None


def process_image(
    original_path: str,
    operation: str,
    width: Optional[int] = None,
    height: Optional[int] = None,
    filter_type: Optional[str] = None
) -> (str, str):
    """
    Processes an image and saves the result.
    Returns: (processed_image_id, processed_image_filename)
    """
    with Image.open(original_path) as img:
        processed_img = img.copy()

        if operation == "resize":
            if width is None or height is None:
                raise ValueError("Width and height are required for resize.")
            processed_img = processed_img.resize((width, height))
        elif operation == "filter":
            # Simple demo filters: BLUR, CONTOUR, etc.
            if filter_type == "blur":
                processed_img = processed_img.filter(ImageFilter.BLUR)
            elif filter_type == "contour":
                processed_img = processed_img.filter(ImageFilter.CONTOUR)
            elif filter_type == "edge_enhance":
                processed_img = processed_img.filter(ImageFilter.EDGE_ENHANCE)
            else:
                raise ValueError("Invalid filter_type.")
        else:
            raise ValueError("Invalid operation.")

        processed_id = generate_unique_id()
        ext = get_file_ext(original_path) or ".png"
        processed_fn = f"{processed_id}{ext}"
        processed_path = os.path.join(PROCESSED_IMAGE_PATH, processed_fn)
        processed_img.save(processed_path)
        return processed_id, processed_fn


# === API Endpoints ===

# PUBLIC_INTERFACE
@app.get("/", summary="Health check endpoint", tags=["upload"])
def health_check():
    """Returns API health status."""
    return {"message": "Healthy"}


# PUBLIC_INTERFACE
@app.post(
    "/upload-image/",
    response_model=ImageUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload an image",
    tags=["upload"],
    description="Upload an image file. Returns an image ID."
)
async def upload_image(image: UploadFile = File(...)):
    """Upload an image. Accepts png, jpg, jpeg, bmp, gif, webp."""
    if not is_image_file(image.filename):
        raise HTTPException(status_code=415, detail="Unsupported file type.")

    image_id = generate_unique_id()
    ext = get_file_ext(image.filename)
    filename = f"{image_id}{ext}"
    save_path = os.path.join(IMAGE_STORAGE_PATH, filename)

    try:
        save_upload_file(image, save_path)
        # Validate it can be loaded as image
        with Image.open(save_path) as img:
            img.verify()
    except Exception as e:
        if os.path.exists(save_path):
            os.remove(save_path)
        raise HTTPException(status_code=400, detail=f"Upload error: {str(e)}")

    return ImageUploadResponse(
        image_id=image_id,
        filename=filename,
        message="Image uploaded successfully."
    )


# PUBLIC_INTERFACE
@app.post(
    "/process-image/",
    response_model=ProcessResponse,
    status_code=status.HTTP_200_OK,
    summary="Process an uploaded image",
    tags=["processing"],
    description="Performs image processing (resize/filter) on an uploaded image. Returns processed image ID. POST body: {image_id, operation, ...}"
)
def process_image_endpoint(process_req: ProcessRequest, image_id: str = Query(..., description="ID of image to process")):
    """
    Process an uploaded image (by image_id) using specified operation and parameters.
    """
    original_path = get_image_path(image_id, processed=False)
    if not original_path or not os.path.exists(original_path):
        raise HTTPException(status_code=404, detail="Image not found.")

    try:
        processed_id, processed_fn = process_image(
            original_path,
            process_req.operation,
            width=process_req.width,
            height=process_req.height,
            filter_type=process_req.filter_type
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

    return ProcessResponse(
        processed_id=processed_id,
        original_id=image_id,
        operation=process_req.operation,
        filename=processed_fn,
        message="Image processed successfully."
    )


# PUBLIC_INTERFACE
@app.get(
    "/get-image/",
    summary="Retrieve (download) an image by ID",
    tags=["results"],
    description="Returns the original or processed image file."
)
def get_image(
    image_id: str = Query(..., description="ID of image to retrieve"),
    processed: bool = Query(False, description="Whether to fetch the processed image"),
):
    """
    Given an image_id (and processed flag), returns the image file.
    """
    img_path = get_image_path(image_id, processed=processed)

    if not img_path or not os.path.exists(img_path):
        raise HTTPException(status_code=404, detail="Image not found.")

    filename = os.path.basename(img_path)
    return FileResponse(img_path, filename=filename, media_type="application/octet-stream")


# PUBLIC_INTERFACE
@app.get(
    "/list-images/",
    summary="List uploaded and processed images",
    tags=["results"],
    description="Lists uploaded and processed images by ID and filename."
)
def list_images(processed: bool = Query(False, description="List processed images")):
    """
    Returns a list of stored image IDs and filenames.
    """
    base = PROCESSED_IMAGE_PATH if processed else IMAGE_STORAGE_PATH
    results = []
    for fname in os.listdir(base):
        image_id = fname.split('.')[0]
        results.append({"id": image_id, "filename": fname})
    return results

# === API Documentation auto-generated at /docs ===

# To use:
#  - Upload an image via POST /upload-image/
#  - Process via POST /process-image/?image_id=...
#  - Download via GET /get-image/?image_id=...&processed=...
