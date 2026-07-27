from fastapi import APIRouter, Depends

from app.core.deps import get_current_user
from app.schemas.ai import AIRequest, AIResponse
from app.services.ai_service import AIServiceLayer

router = APIRouter()
service = AIServiceLayer()


@router.get("/providers")
def providers(_: object = Depends(get_current_user)):
    return [provider.__dict__ for provider in service.providers()]


@router.post("/chat-with-data", response_model=AIResponse)
def chat_with_data(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("chat_with_data", prompt=prompt)


@router.post("/natural-language-sql", response_model=AIResponse)
def natural_language_sql(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("natural_language_sql", prompt=prompt)


@router.post("/business-insights", response_model=AIResponse)
def business_insights(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("business_insights", prompt=prompt)


@router.post("/executive-summary", response_model=AIResponse)
def executive_summary(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("executive_summary", prompt=prompt)


@router.post("/prediction-explanation", response_model=AIResponse)
def prediction_explanation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("prediction_explanation", prompt=prompt)


@router.post("/automatic-report-generation", response_model=AIResponse)
def automatic_report_generation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("automatic_report_generation", prompt=prompt)


@router.post("/data-storytelling", response_model=AIResponse)
def data_storytelling(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("data_storytelling", prompt=prompt)


@router.post("/forecast-explanation", response_model=AIResponse)
def forecast_explanation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("forecast_explanation", prompt=prompt)


@router.post("/anomaly-explanation", response_model=AIResponse)
def anomaly_explanation(payload: AIRequest | None = None, _: object = Depends(get_current_user)):
    prompt = payload.prompt if payload else ""
    return service.execute_feature("anomaly_explanation", prompt=prompt)

