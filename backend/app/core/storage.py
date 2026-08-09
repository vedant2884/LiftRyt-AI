"""Local-disk file storage for user uploads (avatars today).

backend/ is bind-mounted into the container as /app for local dev, so
anything written under UPLOADS_DIR lands on the host filesystem too and
survives container recreation — no separate named volume needed. Deliberately
not S3/Cloudinary: this is a self-hosted single-instance app with no existing
cloud storage account wired in, and the disk + StaticFiles approach needs zero
extra infrastructure or credentials to work out of the box.
"""

from pathlib import Path

UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads"
AVATARS_DIR = UPLOADS_DIR / "avatars"
