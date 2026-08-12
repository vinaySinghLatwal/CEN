from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel
from src.users.schemas import UserResponse
from src.societies.schemas import SocietyResponse


class NearbyQuery(BaseModel):
    address: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class NearbySocietyResult(BaseModel):
    society: SocietyResponse
    distance_km: float
    match_reason: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ChatMessageItem(BaseModel):
    role: str  # 'user' | 'assistant'
    content: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ChatbotQueryPayload(BaseModel):
    message: str
    history: Optional[List[ChatMessageItem]] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )



class ChatbotResponsePayload(BaseModel):
    answer: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class MarketplaceMatchPayload(BaseModel):
    query: str
    society_id: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class MatchItemResult(BaseModel):
    item: dict
    kind: str  # skill | resource
    score: int
    reason: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class AutoTagPayload(BaseModel):
    text: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class AutoTagResult(BaseModel):
    category: str
    tags: List[str]

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class CategorizeComplaintPayload(BaseModel):
    text: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class CategorizeComplaintResult(BaseModel):
    category: str
    priority: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class VolunteerSuggestionResult(BaseModel):
    user: UserResponse
    score: int
    reason: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class VerifyIdProofPayload(BaseModel):
    image_url: str
    user_name: Optional[str] = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class VerifyIdProofResult(BaseModel):
    is_valid_id: bool
    confidence: float
    document_type: str
    extracted_name: Optional[str] = None
    reason: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class CheckEventClashPayload(BaseModel):
    title: str
    description: str
    start_time: str
    end_time: str
    society_id: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class CheckEventClashResult(BaseModel):
    has_clash: bool
    reason: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class CoordinatorEventSuggestion(BaseModel):
    title: str
    description: str
    reason: str

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )


class ResidentSuggestionsResult(BaseModel):
    skill_suggestions: List[dict]
    volunteer_suggestions: List[dict]

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
    )
