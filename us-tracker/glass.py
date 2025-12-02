import cv2
import numpy as np
import random
import math

# --- CONFIGURATION ---
INPUT_IMAGE = 'us-tracker/input.jpg'  # <--- CHECK YOUR FILENAME
OUTPUT_SVG = 'pattern.svg'

# --- YOUR 10 GLASS COLORS ---
MY_COLORS = [
    (230, 190, 210),   # 0: Lavender
    (20, 100, 0),      # 1: Emerald Green
    (20, 200, 120),    # 2: Lime Green
    (180, 20, 0),      # 3: Royal Blue
    (250, 200, 100),   # 4: Sky Blue
    (10, 180, 210),    # 5: Gold
    (0, 255, 255),     # 6: Yellow
    (0, 140, 255),     # 7: Tangerine
    (0, 100, 255),     # 8: Orange
    (10, 10, 220)      # 9: Red
]

# Global State
state = {
    'shards': [],       
    'img_orig': None,
    'glass_canvas': None,
    'scale_factor': 1.0
}

def get_weighted_distance(c1, c2):
    # FIX: Convert all inputs to integers immediately
    # c1 is usually float (from cv2.mean), c2 is int (from MY_COLORS)
    t_r, t_g, t_b = int(c1[2]), int(c1[1]), int(c1[0])
    p_r, p_g, p_b = int(c2[2]), int(c2[1]), int(c2[0])

    rmean = (t_r + p_r) // 2  # Use integer division (//)
    r = t_r - p_r
    g = t_g - p_g
    b = t_b - p_b
    
    # Now valid because all inputs are integers
    return math.sqrt((((512+rmean)*r*r)>>8) + 4*g*g + (((767-rmean)*b*b)>>8))

def find_smart_color(target_color, palette, chaos_level):
    distances = []
    for i, color in enumerate(palette):
        dist = get_weighted_distance(target_color, color)
        distances.append((dist, i))
    
    distances.sort(key=lambda x: x[0])
    
    if chaos_level == 0:
        return distances[0][1]
    
    # Smart Chaos Logic
    choice_pool = distances[:3]
    weights = [100, chaos_level, chaos_level / 2]
    weights = weights[:len(choice_pool)]
    
    total_weight = sum(weights)
    r = random.uniform(0, total_weight)
    
    upto = 0
    for i, w in enumerate(weights):
        if upto + w >= r:
            return choice_pool[i][1]
        upto += w
    return choice_pool[0][1]

def export_svg(filename, width, height, shards):
    print(f"Exporting SVG to {filename}...")
    with open(filename, 'w') as f:
        f.write(f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">\n')
        for i, (poly, color_idx) in enumerate(shards):
            points_str = " ".join([f"{p[0]},{p[1]}" for p in poly])
            b, g, r = MY_COLORS[color_idx]
            hex_color = f"#{r:02x}{g:02x}{b:02x}"
            f.write(f'  <polygon points="{points_str}" fill="{hex_color}" stroke="black" stroke-width="2" id="shard_{i}"/>\n')
            
            # Numbering
            M = cv2.moments(poly)
            if M['m00'] != 0:
                cx = int(M['m10'] / M['m00'])
                cy = int(M['m01'] / M['m00'])
                # Only number if piece is large enough
                if cv2.contourArea(poly) > 100:
                    f.write(f'  <text x="{cx}" y="{cy}" font-family="Arial" font-size="12" fill="white" text-anchor="middle">{color_idx}</text>\n')

        f.write('</svg>')
    print("Done!")

def redraw_canvas():
    height, width, _ = state['img_orig'].shape
    canvas = np.zeros_like(state['img_orig'])
    
    for poly, color_idx in state['shards']:
        color = MY_COLORS[color_idx]
        cv2.fillPoly(canvas, [poly], color)
        cv2.polylines(canvas, [poly], True, (20, 20, 20), 1)
    
    state['glass_canvas'] = canvas
    
    preview_h = 800
    state['scale_factor'] = preview_h / height
    preview_w = int(width * state['scale_factor'])
    preview = cv2.resize(canvas, (preview_w, preview_h))
    cv2.imshow("Stained Glass Maker", preview)

def mouse_callback(event, x, y, flags, param):
    if event == cv2.EVENT_LBUTTONDOWN or event == cv2.EVENT_RBUTTONDOWN:
        real_x = int(x / state['scale_factor'])
        real_y = int(y / state['scale_factor'])
        click_point = (real_x, real_y)
        
        for i, (poly, color_idx) in enumerate(state['shards']):
            if cv2.pointPolygonTest(poly, click_point, False) >= 0:
                new_idx = color_idx
                if event == cv2.EVENT_LBUTTONDOWN:
                    new_idx = (color_idx + 1) % len(MY_COLORS)
                else:
                    new_idx = (color_idx - 1) % len(MY_COLORS)
                
                state['shards'][i] = (poly, new_idx)
                print(f"Piece {i} -> Color {new_idx}")
                redraw_canvas()
                break

def generate_pattern(val=0):
    num_shards = cv2.getTrackbarPos("Size", "Stained Glass Maker")
    chaos_level = cv2.getTrackbarPos("Smart Chaos", "Stained Glass Maker")
    seed_val = cv2.getTrackbarPos("Seed", "Stained Glass Maker")
    
    # MAC FIX: Prevent negative values from sliders
    if num_shards < 10: num_shards = 300
    if chaos_level < 0: chaos_level = 0
    if seed_val < 0: seed_val = 42
    
    random.seed(seed_val)
    np.random.seed(seed_val)
    
    img = state['img_orig']
    height, width, _ = img.shape
    
    points = []
    step = int(width / 15)
    for x in range(0, width, step): points.append((x, 0))
    for x in range(0, width, step): points.append((x, height - 1))
    for y in range(0, height, step): points.append((0, y))
    for y in range(0, height, step): points.append((width - 1, y))
    
    for _ in range(num_shards):
        points.append((random.randint(0, width-1), random.randint(0, height-1)))

    rect = (0, 0, width, height)
    subdiv = cv2.Subdiv2D(rect)
    for p in points: subdiv.insert(p)
    
    (facets, centers) = subdiv.getVoronoiFacetList([])
    
    new_shards = []
    for facet in facets:
        poly = np.array(facet, dtype=np.int32)
        mask = np.zeros((height, width), dtype=np.uint8)
        cv2.fillPoly(mask, [poly], 255)
        mean_val = cv2.mean(img, mask=mask)
        
        c_idx = find_smart_color(mean_val, MY_COLORS, chaos_level)
        new_shards.append((poly, c_idx))
        
    state['shards'] = new_shards
    redraw_canvas()

# --- MAIN ---
state['img_orig'] = cv2.imread(INPUT_IMAGE)
if state['img_orig'] is None:
    print(f"Error: Could not load {INPUT_IMAGE}")
    exit()

cv2.namedWindow("Stained Glass Maker")
cv2.setMouseCallback("Stained Glass Maker", mouse_callback)

cv2.createTrackbar("Size", "Stained Glass Maker", 300, 2000, generate_pattern)
cv2.createTrackbar("Smart Chaos", "Stained Glass Maker", 0, 100, generate_pattern)
cv2.createTrackbar("Seed", "Stained Glass Maker", 42, 100, generate_pattern)

generate_pattern()

print("--- CONTROLS ---")
print("1. ADJUST sliders to get the shape right.")
print("2. LEFT CLICK a piece to cycle next color.")
print("3. RIGHT CLICK a piece to cycle prev color.")
print("4. Press 's' to Save JPG and SVG (Vector).")
print("5. Press 'q' to Quit.")

while True:
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'): break
    if key == ord('s'):
        h, w, _ = state['img_orig'].shape
        cv2.imwrite("final_glass.jpg", state['glass_canvas'])
        export_svg(OUTPUT_SVG, w, h, state['shards'])
        print(f"Saved JPG and {OUTPUT_SVG}")

cv2.destroyAllWindows()