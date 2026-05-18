from sqlalchemy.orm import Session

from app.models.tag import Tag
from app.utils.tag_rules import TAG_RULES


def get_tag_by_name(db: Session, name: str) -> Tag | None:
    return db.query(Tag).filter(Tag.name == name).first()


def ensure_controlled_tag_exists(db: Session, tag_name: str) -> Tag | None:
    rule = TAG_RULES.get(tag_name)

    if not rule:
        return None

    tag = get_tag_by_name(db, tag_name)

    if tag:
        return tag

    tag = Tag(
        name=tag_name,
        category=rule["category"],
    )

    db.add(tag)
    db.flush()

    return tag
