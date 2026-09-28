.PHONY: help setup dev backend frontend test build clean

help:
	@printf '%s\n' 'SkillTrace development commands' \
	  '  make setup    Install frontend and backend development dependencies' \
	  '  make backend  Run the FastAPI development server' \
	  '  make frontend Run the Next.js development server' \
	  '  make test     Run backend tests and frontend lint' \
	  '  make build    Compile backend and build frontend'

setup:
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
	cd frontend && npm install

backend:
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test:
	cd backend && .venv/bin/pytest
	cd frontend && npm run lint

build:
	cd backend && .venv/bin/python -m compileall app
	cd frontend && npm run build

clean:
	rm -rf frontend/.next frontend/node_modules
	find backend -type d -name __pycache__ -prune -exec rm -rf {} +
