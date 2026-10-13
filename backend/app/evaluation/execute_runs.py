"""
Stage 15 — Two-Run Deterministic Reproducibility and Multi-Dataset Validation Script.
Executes the benchmark twice across all 3 datasets under the expanded 12-scenario matrix.
Saves machine-readable JSON, CSV, and Markdown reports to backend/app/evaluation/results/.
"""
import os
import json
from app.core.database import SessionLocal
from app.evaluation.config import EvaluationConfig
from app.evaluation.adapters import (
    TelcoChurnAdapter,
    BreastCancerAdapter,
    WineRecognitionAdapter,
)
from app.evaluation.runner import ResearchEvaluationRunner


def execute_two_runs():
    db = SessionLocal()
    try:
        config = EvaluationConfig(
            scenario_matrix="expanded",
            random_seed=42,
            stratified_split=True,
        )
        runner = ResearchEvaluationRunner(db=db, config=config)

        adapters = [
            TelcoChurnAdapter(random_seed=config.random_seed),
            BreastCancerAdapter(random_seed=config.random_seed),
            WineRecognitionAdapter(random_seed=config.random_seed),
        ]

        output_dir = os.path.join(os.path.dirname(__file__), "results")
        os.makedirs(output_dir, exist_ok=True)

        print(f"[RUN 1] Starting execution with protocol hash: {config.get_protocol_hash()}...")
        run_1_res = runner.run_benchmark(adapters=adapters, scenario_mode="expanded")
        j1, c1, m1 = runner.save_results(run_1_res, output_dir=output_dir, run_id="run_1")
        print(f"[RUN 1] Saved:\n  JSON: {j1}\n  CSV:  {c1}\n  MD:   {m1}")

        print(f"\n[RUN 2] Starting execution with protocol hash: {config.get_protocol_hash()}...")
        run_2_res = runner.run_benchmark(adapters=adapters, scenario_mode="expanded")
        j2, c2, m2 = runner.save_results(run_2_res, output_dir=output_dir, run_id="run_2")
        print(f"[RUN 2] Saved:\n  JSON: {j2}\n  CSV:  {c2}\n  MD:   {m2}")

        # Reproducibility Comparison
        print("\n[VALIDATION] Running comparative reproducibility analysis...")
        comparison = runner.compare_runs(run_1_res, run_2_res)
        comparison_path = os.path.join(output_dir, "reproducibility_comparison.json")
        with open(comparison_path, "w", encoding="utf-8") as f:
            json.dump(comparison, f, indent=2)

        print(f"[VALIDATION] Comparison summary:")
        print(f"  Reproducible:                  {comparison['reproducible']}")
        print(f"  Mismatches count:              {len(comparison['mismatches'])}")
        print(f"  Decisions compared:            {comparison['total_decisions_compared']}")
        print(f"  Decisions matching:            {comparison['matching_decisions']}")
        print(f"  Decision reproducibility rate: {comparison['decision_reproducibility_rate']:.2%}")
        print(f"  Timing variability:            {comparison['timing_variability']}")

        return comparison
    finally:
        db.close()


def execute_final_benchmark(output_dir: str | None = None) -> dict:
    """
    Stage 18 — Final Research Evaluation Benchmark Execution.
    Generates:
      - final_benchmark_run_1.json, .csv
      - final_benchmark_run_2.json, .csv
      - final_benchmark_summary.md
      - final_reproducibility_comparison.json
    """
    db = SessionLocal()
    try:
        config = EvaluationConfig(
            scenario_matrix="expanded",
            random_seed=42,
            stratified_split=True,
        )
        runner = ResearchEvaluationRunner(db=db, config=config)

        adapters = [
            TelcoChurnAdapter(random_seed=config.random_seed),
            BreastCancerAdapter(random_seed=config.random_seed),
            WineRecognitionAdapter(random_seed=config.random_seed),
        ]

        if output_dir is None:
            output_dir = os.path.join(os.path.dirname(__file__), "results")
        os.makedirs(output_dir, exist_ok=True)

        print(f"[STAGE 18 FINAL RUN 1] Protocol Hash: {config.get_protocol_hash()}...")
        run_1_res = runner.run_benchmark(adapters=adapters, scenario_mode="expanded")
        j1, c1, _ = runner.save_results(run_1_res, output_dir=output_dir, run_id="final_benchmark_run_1")

        print(f"[STAGE 18 FINAL RUN 2] Protocol Hash: {config.get_protocol_hash()}...")
        run_2_res = runner.run_benchmark(adapters=adapters, scenario_mode="expanded")
        j2, c2, _ = runner.save_results(run_2_res, output_dir=output_dir, run_id="final_benchmark_run_2")

        # Reproducibility Comparison
        comparison = runner.compare_runs(run_1_res, run_2_res)
        comp_path = os.path.join(output_dir, "final_reproducibility_comparison.json")
        with open(comp_path, "w", encoding="utf-8") as f:
            json.dump(comparison, f, indent=2)

        # Generate final_benchmark_summary.md
        summary_md = runner.generate_markdown_report(run_1_res)
        summary_path = os.path.join(output_dir, "final_benchmark_summary.md")
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(summary_md)

        print(f"[STAGE 18] Final artifacts successfully generated in {output_dir}:")
        print(f"  Run 1: {j1}, {c1}")
        print(f"  Run 2: {j2}, {c2}")
        print(f"  Summary: {summary_path}")
        print(f"  Comparison: {comp_path}")
        return {
            "run_1_json": j1,
            "run_1_csv": c1,
            "run_2_json": j2,
            "run_2_csv": c2,
            "summary_md": summary_path,
            "comparison_json": comp_path,
            "comparison": comparison,
        }
    finally:
        db.close()


if __name__ == "__main__":
    execute_two_runs()
    execute_final_benchmark()
