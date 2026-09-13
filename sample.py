#!/usr/bin/env python3
"""
TRACKSHIFT: Dynamic Constraint-Based F1 Energy & Race Decision Engine
Python Runner / Benchmark Interface
"""

import subprocess
import sys
import os

def main():
    print("\n" + "=" * 76)
    print(" TRACKSHIFT // DYNAMIC CONSTRAINT-BASED F1 ENERGY DECISION ENGINE")
    print("=" * 76)
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # 1. Run the test suite first
    print("\n>>> Running Automated Mathematical & Optimizer Verification Suite...")
    res_test = subprocess.run(["node", os.path.join(script_dir, "tests", "test_optimizer.js")])
    if res_test.returncode != 0:
        print("Test suite failed!")
        sys.exit(1)
        
    # 2. Run the live simulation
    print("\n>>> Running Live Stint Simulation across Track Zones...")
    res_sim = subprocess.run(["node", os.path.join(script_dir, "run_simulation.js")])
    if res_sim.returncode != 0:
        print("Simulation failed!")
        sys.exit(1)

    print("\n" + "=" * 76)
    print(" Live Web Dashboard is active and available at:")
    print(" http://localhost:5173/")
    print("=" * 76 + "\n")

if __name__ == "__main__":
    main()
