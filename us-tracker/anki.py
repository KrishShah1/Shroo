import json
import urllib.request
import webbrowser
import os
import re
from collections import Counter

# --- CONFIGURATION ---
ANKI_CONNECT_URL = "http://localhost:8765"
TAG_NAME = "needs_relearning"  # The tag added to hard cards
LAPSE_THRESHOLD = 4           # Cards forgotten more than X times
EASE_THRESHOLD = 210          # Cards with ease factor below X%
OUTPUT_HTML_FILE = "relearning_dashboard.html"

def invoke(action, **params):
    """Helper to communicate with AnkiConnect."""
    requestJson = json.dumps({
        "action": action,
        "params": params,
        "version": 6
    }).encode('utf-8')
    
    try:
        response = json.load(urllib.request.urlopen(urllib.request.Request(ANKI_CONNECT_URL, requestJson)))
    except Exception as e:
        print(f"Error: Could not connect to Anki. Is it running with AnkiConnect installed? ({e})")
        return None

    if len(response) != 2:
        print("Error: Invalid response fields.")
        return None
    if 'error' not in response:
        print("Error: Response is missing required error field.")
        return None
    if response['error'] is not None:
        # We handle this in the calling function if needed
        return {"error": response['error']}
    
    return response['result']

def find_hard_cards():
    """Finds cards based on lapses and ease."""
    print(f"🔍 Searching for cards with > {LAPSE_THRESHOLD} lapses OR < {EASE_THRESHOLD}% ease...")
    query = f"(prop:lapses>{LAPSE_THRESHOLD} OR prop:ease<{EASE_THRESHOLD/100})"
    card_ids = invoke("findCards", query=query)
    
    if isinstance(card_ids, dict) and 'error' in card_ids:
        print(f"❌ Error searching cards: {card_ids['error']}")
        return []

    if not card_ids:
        print("✅ No difficult cards found! She's doing great.")
        return []
    
    return card_ids

def get_card_details(card_ids):
    """Retrieves content (Front/Back) and tags for the found cards."""
    return invoke("cardsInfo", cards=card_ids)

def tag_cards(card_ids):
    """Adds a specific tag to these cards so they can be filtered."""
    # Get note IDs from card IDs (AnkiConnect 'addTags' works on Notes)
    cards_info = invoke("cardsInfo", cards=card_ids)
    if not cards_info: return

    note_ids = list(set([c['note'] for c in cards_info]))
    invoke("addTags", notes=note_ids, tags=TAG_NAME)
    print(f"🏷️  Tagged {len(note_ids)} notes with '{TAG_NAME}'.")

def analyze_topics(cards_data):
    """Parses tags to find the most common weak topics."""
    topic_counter = Counter()
    
    ignore_keywords = ["AnKing", "AK_MCAT", "Step1", "Step2", "v11", "v12", "leech", "marked", TAG_NAME]

    for card in cards_data:
        tags = card.get('tags', [])
        for tag in tags:
            # Clean up tag structure (Anki uses :: for hierarchy)
            parts = tag.split('::')
            
            # Filter out utility tags and top-level deck names
            meaningful_parts = [p for p in parts if not any(k in p for k in ignore_keywords) and not p.startswith('#')]
            
            if meaningful_parts:
                # Use the most specific topic (last valid part) or the whole path
                topic = " > ".join(meaningful_parts)
                topic_counter[topic] += 1

    return topic_counter.most_common(10)

def analyze_uworld(cards_data):
    """Finds UWorld Question IDs associated with these cards."""
    qid_counter = Counter()
    
    # Regex to find UWorld IDs in tags (common formats: #UWorld::12345, UWorld::QID::12345)
    qid_pattern = re.compile(r'UWorld.*?(\d{4,7})', re.IGNORECASE)

    for card in cards_data:
        tags = card.get('tags', [])
        for tag in tags:
            match = qid_pattern.search(tag)
            if match:
                qid = match.group(1)
                qid_counter[qid] += 1
                
    return qid_counter.most_common(15)

def create_cram_deck_attempt():
    """Attempts to create a filtered deck, falls back to Browser."""
    deck_name = "⚠ Cram Session (Relearning)"
    search_term = f"tag:{TAG_NAME}"
    
    print(f"🏗️  Attempting to create filtered deck '{deck_name}'...")
    
    # Try the undocumented/rare createFilteredDeck action first
    result = invoke("createFilteredDeck", deck=deck_name, query=search_term, reschedule=False)
    
    if result and not isinstance(result, dict):
        print("✅ Filtered deck created successfully!")
    else:
        # Fallback: Open Browser
        print("⚠️  Could not auto-create filtered deck (API limitation).")
        print("📂 Opening Anki Browser with cards selected instead...")
        invoke("guiBrowse", query=search_term)

def generate_dashboard(cards_data, topics, uworld_qids):
    """Creates a rich HTML dashboard."""
    
    # Rows for UWorld Table
    uworld_rows = ""
    for qid, count in uworld_qids:
        # QID link is a guess, but often searching the QID in UWorld works
        uworld_rows += f"""
        <tr>
            <td><strong>{qid}</strong></td>
            <td>{count} related cards</td>
            <td><a href="#" style="color:#007bff; text-decoration:none;">Search in UWorld</a></td>
        </tr>
        """
        
    # Rows for Topics Table
    topic_rows = ""
    for topic, count in topics:
        topic_rows += f"""
        <tr>
            <td>{topic}</td>
            <td><div style="background:#eee; width: 100px; height: 10px; border-radius:5px; overflow:hidden;">
                <div style="background:#ff4757; width:{min(count * 5, 100)}%; height:100%;"></div>
            </div></td>
            <td>{count}</td>
        </tr>
        """
        
    # Cards List
    card_html = ""
    for card in cards_data[:50]: # Limit to top 50 for the sheet
        front = card['fields'].get('Front', {}).get('value', 'Unknown Question')
        # Quick cleanup of potential image tags for the summary view
        front_text = re.sub(r'<img[^>]*>', '[Image]', front)
        
        card_html += f"""
        <div class="card">
            <div class="card-header">
                <span class="badge">Lapses: {card.get('lapses', 0)}</span>
                <span style="font-size:0.8em; color:#888;">Ease: {card.get('factor', 0)/10}%</span>
            </div>
            <div class="question">{front_text}</div>
        </div>
        """

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Anki Relearning Dashboard</title>
        <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f0f2f5; padding: 40px; color: #333; }}
            .container {{ max-width: 1000px; margin: 0 auto; }}
            h1, h2 {{ color: #2c3e50; }}
            .grid {{ display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; }}
            .panel {{ background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }}
            
            table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
            td, th {{ padding: 10px; text-align: left; border-bottom: 1px solid #eee; }}
            
            .card {{ background: white; padding: 15px; border-radius: 8px; margin-bottom: 10px; border-left: 4px solid #ff4757; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }}
            .card-header {{ display: flex; justify-content: space-between; margin-bottom: 5px; }}
            .badge {{ background: #ff4757; color: white; padding: 2px 6px; border-radius: 4px; font-size: 0.75em; font-weight: bold; }}
            .question {{ font-size: 0.95em; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div style="text-align:center; margin-bottom: 40px;">
                <h1>🧠 Relearning Dashboard</h1>
                <p>Found <strong>{len(cards_data)}</strong> cards that need attention.</p>
            </div>

            <div class="grid">
                <div class="panel">
                    <h2>Weakest Topics</h2>
                    <p style="color:#666; font-size:0.9em;">Based on tags from your failed cards.</p>
                    <table>
                        {topic_rows}
                    </table>
                </div>
                
                <div class="panel">
                    <h2>UWorld Question IDs</h2>
                    <p style="color:#666; font-size:0.9em;">Review these questions in UWorld.</p>
                    <table>
                        <thead><tr><th>QID</th><th>Cards</th><th>Action</th></tr></thead>
                        <tbody>{uworld_rows}</tbody>
                    </table>
                </div>
            </div>

            <h2>Top 50 Cards to Review</h2>
            {card_html}
        </div>
    </body>
    </html>
    """
    
    with open(OUTPUT_HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html_content)
    
    print(f"📄 Generated Dashboard: {OUTPUT_HTML_FILE}")
    return OUTPUT_HTML_FILE

def main():
    print("--- Anki MCAT Relearner ---")
    
    # 1. Find Cards
    card_ids = find_hard_cards()
    if not card_ids:
        return

    # 2. Get Details
    print(f"📥 Downloading data for {len(card_ids)} cards...")
    cards_details = get_card_details(card_ids)

    # 3. Sort by difficulty
    cards_details.sort(key=lambda x: x['lapses'], reverse=True)

    # 4. Tag them
    tag_cards(card_ids)

    # 5. Analyze
    print("📊 Analyzing Topics and UWorld IDs...")
    topics = analyze_topics(cards_details)
    uworld = analyze_uworld(cards_details)

    # 6. Generate Dashboard
    file_path = generate_dashboard(cards_details, topics, uworld)
    webbrowser.open('file://' + os.path.realpath(file_path))

    # 7. Create Deck / Open Browser
    create_cram_deck_attempt()

if __name__ == "__main__":
    main()