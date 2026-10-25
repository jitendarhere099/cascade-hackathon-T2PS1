.PHONY: dev test eval install clean help

help:
	@echo "Firstlight Commands:"
	@echo "  make install  - Install backend (uv) and frontend (npm) dependencies"
	@echo "  make dev      - Start backend and frontend development servers"
	@echo "  make test     - Run backend and frontend test suites"
	@echo "  make eval     - Run 300-episode batch evaluation and generate report.html"
	@echo "  make clean    - Remove build artifacts and temporary caches"

install:
	cd backend && uv sync --extra dev
	cd frontend && npm install

dev:
	@echo "Starting Firstlight Backend and Frontend..."
	powershell -Command "Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd backend; uv run uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload'; Start-Process powershell -ArgumentList '-NoExit', '-Command', 'cd frontend; npm run dev'"

test:
	cd backend && uv run pytest tests -v
	cd frontend && npx tsc --noEmit

eval:
	cd backend && uv run python -m eval.run_eval --episodes 300 --output eval/report.html

clean:
	rm -rf backend/.venv backend/__pycache__ frontend/dist frontend/node_modules/.vite eval/report.html
