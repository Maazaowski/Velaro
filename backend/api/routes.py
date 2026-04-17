"""API routes for the Velaro backend."""

from fastapi import APIRouter
from api.models import system_router
from api.training import training_router
from api.inference import inference_router
from api.publish import publish_router
from api.settings import settings_router
from api.finetune import finetune_router

router = APIRouter()
router.include_router(system_router, prefix="/system", tags=["system"])
router.include_router(training_router, prefix="/training", tags=["training"])
router.include_router(inference_router, prefix="/inference", tags=["inference"])
router.include_router(publish_router, prefix="/publish", tags=["publish"])
router.include_router(settings_router, prefix="/settings", tags=["settings"])
router.include_router(finetune_router, prefix="/finetune", tags=["finetune"])
