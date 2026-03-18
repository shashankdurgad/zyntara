# Persona Retrieval Service

FastAPI service that loads a subset of the [NVIDIA Nemotron-Personas-USA](https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA) dataset, embeds personas with Gemini, and exposes vector similarity search for RAG-based persona generation.

## Setup

```bash
cd persona-service
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GOOGLE_API_KEY` | Google Gemini API key for embeddings | required |
| `INDEX_SUBSET_SIZE` | Number of personas to index from dataset | 10000 |
| `EMBED_BATCH_SIZE` | Batch size for embedding API calls | 25 |

## Run

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Or from project root:

```bash
npm run persona:service
```

**Note:** First startup downloads the dataset (~2.6GB) and builds the index. This can take several minutes depending on `INDEX_SUBSET_SIZE`.

## API

### `GET /health`

Returns `{ "status": "ok", "index_ready": true }` when the service is ready.

### `POST /retrieve`

Request body:

```json
{
  "query": "tech worker in Seattle, age 30-40",
  "k": 5
}
```

Response:

```json
{
  "personas": [ /* array of Nemotron persona records */ ],
  "count": 5
}
```

## Dataset

Uses [nvidia/Nemotron-Personas-USA](https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA) from Hugging Face. A stratified subset is loaded and embedded at startup. Persona fields concatenated for embedding: `persona`, `professional_persona`, `cultural_background`, `skills_and_expertise`, `hobbies_and_interests`, `career_goals_and_ambitions`.
