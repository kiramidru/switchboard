import io
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 16_000_000
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


def prepare_image(data: bytes) -> bytes:
    """Check real file content, cap decoded size, and strip metadata before sending."""
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as image:
                if image.format not in {"JPEG", "PNG", "WEBP"}:
                    raise ValueError("Use a JPEG, PNG, or WebP image.")
                if image.width * image.height > MAX_PIXELS:
                    raise ValueError("Use an image smaller than 16 megapixels.")
                if getattr(image, "n_frames", 1) != 1:
                    raise ValueError("Use a still image, not an animation.")
                image.load()
                image = ImageOps.exif_transpose(image)
                image.thumbnail((2400, 2400))
                rgba = image.convert("RGBA")
                clean = Image.new("RGB", rgba.size, "white")
                clean.paste(rgba, mask=rgba.getchannel("A"))
                output = io.BytesIO()
                clean.save(output, format="JPEG", quality=92)
                return output.getvalue()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError,
            Image.DecompressionBombWarning) as exc:
        raise ValueError("This image could not be read safely. Choose another JPEG, PNG, or WebP.") from exc
