import pytest

@pytest.fixture
def number():
    pass

def test_1(number, fails):
    if fails:
        pytest.xfail(reason="Should fail")
    assert number % 2 == 0

def test_2():
    assert True

def test_3():
    assert False