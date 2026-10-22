import os
import uvicorn
from bootstrap import prepare

if __name__ == '__main__':
    prepare()
    uvicorn.run('app:app', host='0.0.0.0', port=int(os.environ.get('PORT', '8000')))
