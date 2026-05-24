from fastapi import APIRouter

from app.models import WorkflowRequest, WorkflowResponse
from app.services.asr_service import ASRService
from app.services.digital_human_service import DigitalHumanService
from app.services.llm_service import LLMService
from app.services.publish_service import PublishService
from app.services.tts_service import TTSService
from app.services.video_render_service import VideoRenderService

router = APIRouter()

asr_service = ASRService()
llm_service = LLMService()
tts_service = TTSService()
digital_human_service = DigitalHumanService()
video_render_service = VideoRenderService()
publish_service = PublishService()


@router.post("/extract-script", response_model=WorkflowResponse)
async def extract_script(payload: WorkflowRequest) -> WorkflowResponse:
    script = await asr_service.extract_script(payload.source_url or "mock://source")
    return WorkflowResponse(step="extract-script", status="success", message="Script extraction completed.", data={"script": script})


@router.post("/rewrite-script", response_model=WorkflowResponse)
async def rewrite_script(payload: WorkflowRequest) -> WorkflowResponse:
    script = await llm_service.rewrite_script(
        payload.script or "",
        payload.topic,
        payload.target_style,
        payload.speaking_style,
    )
    return WorkflowResponse(step="rewrite-script", status="success", message="Script rewrite completed.", data={"script": script})


@router.post("/tts", response_model=WorkflowResponse)
async def tts(payload: WorkflowRequest) -> WorkflowResponse:
    data = await tts_service.synthesize(payload.script or "", payload.voice or "studio-default")
    return WorkflowResponse(step="tts", status="success", message="Voice synthesis completed.", data=data)


@router.post("/digital-human", response_model=WorkflowResponse)
async def digital_human(payload: WorkflowRequest) -> WorkflowResponse:
    data = await digital_human_service.generate(payload.options.get("audio_url", "mock://audio/default.wav"))
    return WorkflowResponse(step="digital-human", status="success", message="Digital human adapter completed.", data=data)


@router.post("/render-video", response_model=WorkflowResponse)
async def render_video(payload: WorkflowRequest) -> WorkflowResponse:
    data = await video_render_service.render(payload.task_id)
    return WorkflowResponse(step="render-video", status="success", message="Render adapter completed.", data=data)


@router.post("/publish", response_model=WorkflowResponse)
async def publish(payload: WorkflowRequest) -> WorkflowResponse:
    data = await publish_service.publish(payload.platform or "douyin")
    return WorkflowResponse(step="publish", status="success", message="Publish adapter completed.", data=data)
