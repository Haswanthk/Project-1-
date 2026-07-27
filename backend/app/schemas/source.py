from pydantic import BaseModel, Field, HttpUrl


class RestSourceRequest(BaseModel):
    name: str = Field(min_length=2)
    url: HttpUrl


class SqlSourceRequest(BaseModel):
    name: str = Field(min_length=2)
    connection_url: str
    query: str


class StreamSourceRequest(BaseModel):
    name: str
    source_type: str
    configuration: dict

