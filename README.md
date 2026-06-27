# CareerOS

CareerOS is a full-stack job application assistant with a FastAPI backend, a React/Vite frontend, and Lemma workflow support.

## Run in GitHub Codespaces

1. Open the repository in GitHub Codespaces.
2. Wait for the dev container to finish installing dependencies.
3. Create the environment file from the example values:
   ```bash
   cp .env.example .env
   ```
4. Install Lemma:
   ```bash
   bash setup_lemma.sh
   ```
5. Start the backend in one terminal:
   ```bash
   cd backend
   source .venv/bin/activate
   uvicorn main:app --host 0.0.0.0 --port 5002 --reload
   ```
6. Start the frontend in a second terminal:
   ```bash
   cd frontend
   npm run dev
   ```
7. Open the forwarded ports `3000` and `5002`.

## Optional helper

```bash
./start.sh
```
