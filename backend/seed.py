"""Convenience entry point for the deterministic SkillTrace demo seed.

Usage:
    python seed.py
    python seed.py --reset
"""

from app.db.seed import main

if __name__ == "__main__":
    main()
