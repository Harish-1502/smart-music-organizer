from functools import lru_cache

import numpy as np
from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    return SentenceTransformer(MODEL_NAME)


def encode_texts(texts: list[str]) -> np.ndarray:
    model = get_embedding_model()
    embeddings = model.encode(texts, normalize_embeddings=True)
    return np.asarray(embeddings)