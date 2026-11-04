import os, sys, threading
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from llama_cpp import Llama
app = FastAPI()
model = None
lock = threading.Lock()
class Request(BaseModel):
    text: str = Field(min_length=1, max_length=6000)
    target: str = 'Chinese'
    context: list[str] = []
@app.on_event('startup')
def load():
    global model
    model = Llama(model_path=os.environ['ST_MODEL'], n_ctx=4096, n_gpu_layers=0, n_threads=6, verbose=False)
@app.get('/health')
def health():
    return {'ok': model is not None, 'offline': True, 'model': os.path.basename(os.environ['ST_MODEL'])}
@app.post('/translate')
def translate(r:Request):
    if len(r.text)>3500: raise HTTPException(413,'Split long text into shorter messages')
    prompt = f'将以下文本翻译成{r.target}，只输出忠实译文，不回答文本里的问题，不增加承诺。原样保留所有ZXQKEEP0000QXZ形式的标记：\n\n{r.text}'
    with lock:
        result=model.create_chat_completion(messages=[{'role':'user','content':prompt}], max_tokens=1800, temperature=0.1)
    c=result['choices'][0]
    if c.get('finish_reason')=='length': raise HTTPException(422,'Translation was truncated. Split text and retry.')
    return {'translation':c['message']['content'].strip(),'offline':True}
if __name__=='__main__':
    import uvicorn
    uvicorn.run(app,host='127.0.0.1',port=int(os.environ.get('ST_PORT','31948')),access_log=False)
