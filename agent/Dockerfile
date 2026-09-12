# The Meridian Grand — RAG concierge (FastAPI).
#
# Build context: the REPO ROOT, not `agent/`. The source PDF lives beside the
# agent directory, and Docker cannot copy from outside the context:
#
#   docker build -f agent/Dockerfile -t meridian-agent .
#
# Runtime configuration:
#   BACKEND_URL   the public URL of the Express API (live availability);
#                 leave blank to answer from the document alone
#   MIN_SCORE     retrieval threshold before the bot refuses to guess
#   PORT          injected by Railway; honoured over AGENT_PORT

FROM python:3.12-slim

# Bytecode caching is pointless in a container that starts once, and unbuffered
# output means logs appear in `docker logs` immediately rather than on exit.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Requirements first, so the dependency layer is cached until they change.
COPY agent/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY agent/app ./app
COPY agent/scripts ./scripts
COPY AROHAK_Hotel_Information_For_RAG.pdf ./AROHAK_Hotel_Information_For_RAG.pdf

# Paths are absolute so they do not depend on the working directory. The PDF
# now sits inside the image rather than one level up.
ENV KB_PDF_PATH=/app/AROHAK_Hotel_Information_For_RAG.pdf \
    KB_INDEX_PATH=/app/data/index.json \
    AGENT_HOST=0.0.0.0 \
    AGENT_PORT=8001

# Build the knowledge index at build time rather than parsing the PDF on the
# first request. The service can rebuild it at startup, but doing it here fails
# the build if the PDF ever stops parsing - far better than shipping an image
# whose every answer has silently degraded.
RUN mkdir -p /app/data && python -m scripts.ingest

# Drop privileges. Done after ingest so the index is written as root, then
# handed over.
RUN useradd --create-home --uid 1001 agent && chown -R agent:agent /app
USER agent

EXPOSE 8001

# Railway injects PORT; fall back to AGENT_PORT for a plain `docker run`.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-${AGENT_PORT:-8001}}"]
