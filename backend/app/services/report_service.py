import json
from pathlib import Path
from typing import Any
import pandas as pd
from datetime import datetime, timezone


class ReportService:
    def __init__(self):
        self.reports_dir = Path("reports")
        self.reports_dir.mkdir(exist_ok=True)

    def generate_report(
        self, title: str, format_type: str, dataset_path: str | None, profile_json: dict
    ) -> str:
        timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
        safe_title = "".join([c if c.isalnum() else "_" for c in title])
        base_name = f"{safe_title}_{timestamp}"

        df = None
        if dataset_path and Path(dataset_path).exists():
            sfx = Path(dataset_path).suffix.lower()
            if sfx == ".csv":
                df = pd.read_csv(dataset_path)
            elif sfx in (".xls", ".xlsx"):
                df = pd.read_excel(dataset_path)

        fmt = format_type.lower()

        if fmt == "csv":
            if df is not None:
                output_path = self.reports_dir / f"{base_name}.csv"
                df.to_csv(output_path, index=False)
                return str(output_path)
            raise ValueError("Cannot generate CSV without a valid dataset")

        elif fmt in ("excel", "xlsx"):
            if df is not None:
                output_path = self.reports_dir / f"{base_name}.xlsx"
                with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                    df.to_excel(writer, sheet_name="Data", index=False)
                    # Add statistics sheet
                    stats = profile_json.get("statistics", {})
                    if stats:
                        rows = []
                        for col, vals in stats.items():
                            row = {"Column": col}
                            row.update({k: v for k, v in vals.items() if v != ""})
                            rows.append(row)
                        if rows:
                            pd.DataFrame(rows).to_excel(writer, sheet_name="Statistics", index=False)
                    # Missing values sheet
                    mv = profile_json.get("missing_values", {})
                    if mv:
                        pd.DataFrame(list(mv.items()), columns=["Column", "Missing Count"]).to_excel(
                            writer, sheet_name="Missing Values", index=False
                        )
                return str(output_path)
            raise ValueError("Cannot generate Excel without a valid dataset")

        elif fmt == "docx":
            from docx import Document
            from docx.shared import Pt, RGBColor
            output_path = self.reports_dir / f"{base_name}.docx"
            doc = Document()
            doc.add_heading(title, 0)
            doc.add_paragraph(
                f"Report generated on: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
            )
            # Dataset overview
            if df is not None:
                doc.add_heading("Dataset Overview", level=1)
                doc.add_paragraph(f"Rows: {len(df)}")
                doc.add_paragraph(f"Columns: {len(df.columns)}")
                doc.add_paragraph(f"Duplicate rows: {profile_json.get('duplicates', 0)}")
            # Missing values
            mv = profile_json.get("missing_values", {})
            if mv:
                doc.add_heading("Missing Values", level=1)
                for col, count in mv.items():
                    doc.add_paragraph(f"  {col}: {count} missing")
            # Statistics
            stats = profile_json.get("statistics", {})
            if stats:
                doc.add_heading("Statistical Summary", level=1)
                for col, vals in list(stats.items())[:15]:
                    doc.add_heading(f"Column: {col}", level=2)
                    for k, v in vals.items():
                        if v != "":
                            doc.add_paragraph(f"  {k}: {v}")
            doc.save(output_path)
            return str(output_path)

        elif fmt == "pdf":
            from reportlab.lib.pagesizes import letter
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            from reportlab.lib.units import inch
            from reportlab.lib import colors
            from reportlab.platypus import (
                SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
            )

            output_path = self.reports_dir / f"{base_name}.pdf"
            doc_pdf = SimpleDocTemplate(str(output_path), pagesize=letter)
            styles = getSampleStyleSheet()
            story = []

            # Title
            story.append(Paragraph(title, styles["Title"]))
            story.append(Paragraph(
                f"Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
                styles["Normal"]
            ))
            story.append(Spacer(1, 0.3 * inch))

            # Dataset overview
            if df is not None:
                story.append(Paragraph("Dataset Overview", styles["Heading1"]))
                overview_data = [
                    ["Metric", "Value"],
                    ["Total Rows", str(len(df))],
                    ["Total Columns", str(len(df.columns))],
                    ["Duplicate Rows", str(profile_json.get("duplicates", 0))],
                    ["Columns", ", ".join(df.columns.tolist())],
                ]
                t = Table(overview_data, colWidths=[2.5 * inch, 4 * inch])
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2563EB")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")]),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]))
                story.append(t)
                story.append(Spacer(1, 0.2 * inch))

            # Missing values
            mv = profile_json.get("missing_values", {})
            if any(v > 0 for v in mv.values()):
                story.append(Paragraph("Missing Values", styles["Heading1"]))
                mv_data = [["Column", "Missing Count"]] + [[k, str(v)] for k, v in mv.items() if v > 0]
                t = Table(mv_data, colWidths=[3 * inch, 2 * inch])
                t.setStyle(TableStyle([
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DC2626")),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                ]))
                story.append(t)
                story.append(Spacer(1, 0.2 * inch))

            # Statistics
            stats = profile_json.get("statistics", {})
            if stats:
                story.append(Paragraph("Statistical Summary", styles["Heading1"]))
                for col, vals in list(stats.items())[:10]:
                    story.append(Paragraph(f"Column: {col}", styles["Heading2"]))
                    clean_vals = {k: str(v) for k, v in vals.items() if v != ""}
                    if clean_vals:
                        stat_data = [["Stat", "Value"]] + list(clean_vals.items())
                        t = Table(stat_data, colWidths=[2 * inch, 3 * inch])
                        t.setStyle(TableStyle([
                            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#4F46E5")),
                            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                            ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                            ("FONTSIZE", (0, 0), (-1, -1), 8),
                        ]))
                        story.append(t)
                    story.append(Spacer(1, 0.15 * inch))

            doc_pdf.build(story)
            return str(output_path)
        else:
            raise ValueError(f"Unsupported format: {format_type}")
