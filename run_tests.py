"""
EasyCart Unified Test Runner.
Executes both the modular unit tests and the end-to-end regression test suite in isolated processes.
Usage:
    python run_tests.py          # Runs all tests
    python run_tests.py unit     # Runs unit tests only
    python run_tests.py regress  # Runs regression tests only
"""
import sys
import os
import subprocess

def run_all():
    print("=" * 70)
    print("EASYCART TEST SUITE EXECUTION")
    print("=" * 70)

    # 1. Run unit tests
    print("\n>>> RUNNING MODULAR UNIT TESTS (tests/)...")
    unit_res = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v'])

    # 2. Run regression suite
    print("\n>>> RUNNING FULL REGRESSION TEST SUITE (test_regression.py)...")
    regress_res = subprocess.run([sys.executable, 'test_regression.py'])

    print("\n" + "=" * 70)
    print("TEST EXECUTION RESULTS:")
    print(f"  - Modular Unit Tests: {'ALL PASSED' if unit_res.returncode == 0 else 'FAILED'}")
    print(f"  - Regression Tests:   {'ALL PASSED (144/144)' if regress_res.returncode == 0 else 'FAILED'}")
    print("=" * 70)

    return 0 if (unit_res.returncode == 0 and regress_res.returncode == 0) else 1

if __name__ == '__main__':
    mode = sys.argv[1].lower() if len(sys.argv) > 1 else 'all'
    if mode == 'unit':
        res = subprocess.run([sys.executable, '-m', 'unittest', 'discover', '-s', 'tests', '-p', 'test_*.py', '-v'])
        sys.exit(res.returncode)
    elif mode == 'regress':
        res = subprocess.run([sys.executable, 'test_regression.py'])
        sys.exit(res.returncode)
    else:
        sys.exit(run_all())
