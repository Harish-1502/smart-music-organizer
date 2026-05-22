def test_create_tag_trims_and_normalizes_valid_payload(client):
    response = client.post(
        "/tags",
        json={"name": "  Focus  ", "category": "  Mood  "},
    )

    assert response.status_code == 200
    assert response.json()["name"] == "focus"
    assert response.json()["category"] == "mood"


def test_create_tag_rejects_empty_name(client):
    response = client.post(
        "/tags",
        json={"name": "   ", "category": "mood"},
    )

    assert response.status_code == 422


def test_create_tag_rejects_empty_category(client):
    response = client.post(
        "/tags",
        json={"name": "focus", "category": "   "},
    )

    assert response.status_code == 422


def test_create_tag_rejects_too_long_name(client):
    response = client.post(
        "/tags",
        json={"name": "a" * 65, "category": "mood"},
    )

    assert response.status_code == 422


def test_create_tag_rejects_too_long_category(client):
    response = client.post(
        "/tags",
        json={"name": "focus", "category": "a" * 65},
    )

    assert response.status_code == 422


def test_create_tag_rejects_control_characters(client):
    response = client.post(
        "/tags",
        json={"name": "focus\nnow", "category": "mood"},
    )

    assert response.status_code == 422


def test_add_tag_to_track_rejects_non_positive_tag_id(client):
    response = client.post(
        "/tags/tracks/1",
        json={"tag_id": 0},
    )

    assert response.status_code == 422
