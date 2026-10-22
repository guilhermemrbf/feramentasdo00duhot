import asyncio
from app import worker
from bootstrap import prepare

if __name__ == '__main__':
    prepare()
    asyncio.run(worker())
