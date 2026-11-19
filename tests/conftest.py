"""
Pytest configuration and fixtures for EasyCart test suite.
"""
import pytest
from tests.base import BaseTestCase

@pytest.fixture(scope="session")
def app():
    BaseTestCase.setUpClass()
    yield BaseTestCase.app
    BaseTestCase.tearDownClass()

@pytest.fixture
def client(app):
    test_client = app.test_client()
    test_client.environ_base['HTTP_X_REQUESTED_WITH'] = 'XMLHttpRequest'
    return test_client
