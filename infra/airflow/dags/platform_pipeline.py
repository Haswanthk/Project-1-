from datetime import datetime

from airflow import DAG
from airflow.operators.empty import EmptyOperator

with DAG(
    dag_id="unified_ai_platform_daily_pipeline",
    schedule="0 2 * * *",
    start_date=datetime(2026, 1, 1),
    catchup=False,
):
    start = EmptyOperator(task_id="start")
    ingest = EmptyOperator(task_id="ingest")
    profile = EmptyOperator(task_id="profile")
    train = EmptyOperator(task_id="train")
    report = EmptyOperator(task_id="report")
    done = EmptyOperator(task_id="done")

    start >> ingest >> profile >> train >> report >> done

