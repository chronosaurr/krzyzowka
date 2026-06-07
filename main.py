import json
import os
import random
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnswerInput(BaseModel):
    word_id: int
    user_answer: str

class VerifyRequest(BaseModel):
    answers: List[AnswerInput]

def load_words(mode="all"):
    """Ładuje słowa z odpowiedniego pliku w zależności od trybu."""
    normal_words = []
    hard_words = []
    
    if os.path.exists("words_normal.json"):
        with open("words_normal.json", "r", encoding="utf-8") as f:
            normal_words = json.load(f)
            
    if os.path.exists("words_hard.json"):
        with open("words_hard.json", "r", encoding="utf-8") as f:
            hard_words = json.load(f)

    if mode == "normal":
        return normal_words
    elif mode == "hard":
        return hard_words
    else:
        return normal_words + hard_words
    

def generate_layout(words_db):
    if not words_db:
        return []
        
    words = sorted(words_db, key=lambda x: len(x["word"]), reverse=True)
    
    layout = []
    grid = {}
    
    def can_place(word, start_row, start_col, direction):
        if direction == 'r':
            if (start_row, start_col - 1) in grid: return False
            if (start_row, start_col + len(word)) in grid: return False
        else:
            if (start_row - 1, start_col) in grid: return False
            if (start_row + len(word), start_col) in grid: return False

        for i, char in enumerate(word):
            r = start_row + (i if direction == 'd' else 0)
            c = start_col + (i if direction == 'r' else 0)
            
            if (r, c) in grid:
                if grid[(r, c)] != char:
                    return False 
            else:
                if direction == 'r':
                    if (r - 1, c) in grid or (r + 1, c) in grid: return False
                else:
                    if (r, c - 1) in grid or (r, c + 1) in grid: return False
                    
        return True

    def place_word(word_obj, start_row, start_col, direction):
        word = word_obj["word"]
        for i, char in enumerate(word):
            r = start_row + (i if direction == 'd' else 0)
            c = start_col + (i if direction == 'r' else 0)
            grid[(r, c)] = char
            
        layout.append({
            "word_id": word_obj["id"],
            "row": start_row,
            "col": start_col,
            "direction": direction,
            "length": len(word),
            "clue": word_obj["clue"]
        })

    first_word = words.pop(0)
    place_word(first_word, 0, 0, 'r')

    for word_obj in words:
        word = word_obj["word"]
        placed = False
        
        for placed_item in layout:
            if placed: break
            
            placed_word_text = next(w["word"] for w in words_db if w["id"] == placed_item["word_id"])
            
            for i, p_char in enumerate(placed_word_text):
                if placed: break
                
                for j, n_char in enumerate(word):
                    if p_char == n_char:
                        if placed_item["direction"] == 'r':
                            new_row = placed_item["row"] - j
                            new_col = placed_item["col"] + i
                            new_dir = 'd'
                        else:
                            new_row = placed_item["row"] + i
                            new_col = placed_item["col"] - j
                            new_dir = 'r'
                            
                        if can_place(word, new_row, new_col, new_dir):
                            place_word(word_obj, new_row, new_col, new_dir)
                            placed = True
                            break
    if layout:
        min_row = min(item["row"] for item in layout)
        min_col = min(item["col"] for item in layout)
        
        for item in layout:
            item["row"] -= min_row
            item["col"] -= min_col 

    return layout

all_words = load_words()

sample_size = min(20, len(all_words))
selected_words = random.sample(all_words, sample_size) if all_words else []

CURRENT_LAYOUT = generate_layout(selected_words)
CURRENT_LAYOUT = []

@app.get("/api/crossword")
def get_crossword():
    global CURRENT_LAYOUT
    if not CURRENT_LAYOUT:
        all_words = load_words("normal")
        sample_size = min(20, len(all_words))
        selected_words = random.sample(all_words, sample_size) if all_words else []
        CURRENT_LAYOUT = generate_layout(selected_words)
        
    return {"layout": CURRENT_LAYOUT}

@app.get("/api/crossword/new/{mode}")
def get_new_crossword(mode: str):
    """Generuje nową krzyżówkę dla podanego trybu (normal lub hard)."""
    global CURRENT_LAYOUT
    
    if mode not in ["normal", "hard"]:
        raise HTTPException(status_code=400, detail="Nieznany tryb trudności")
        
    words_db = load_words(mode)
    sample_size = min(20, len(words_db))
    selected_words = random.sample(words_db, sample_size) if words_db else []
    
    CURRENT_LAYOUT = generate_layout(selected_words)
    
    if not CURRENT_LAYOUT:
        raise HTTPException(status_code=404, detail="Brak danych do wygenerowania krzyżówki")
        
    return {"layout": CURRENT_LAYOUT}

@app.post("/api/verify")
def verify_answers(request: VerifyRequest):
    words_db = load_words("all") 
    results = []
    
    for item in request.answers:
        original = next((w for w in words_db if w["id"] == item.word_id), None)
        if original:
            is_correct = original["word"].upper() == item.user_answer.upper()
            results.append({
                "word_id": item.word_id,
                "is_correct": is_correct
            })
            
    return {"results": results}
