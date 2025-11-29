import React, { useState, useEffect } from 'react';
import { 
  Heart, Check, Plus, Trophy, Calendar, Flame, 
  X, Camera, Utensils, ArrowRight, ArrowLeft, MapPin, 
  RefreshCw, User
} from 'lucide-react';
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, orderBy, serverTimestamp, where 
} from "firebase/firestore";


/*** --- FIREBASE CONFIGURATION --- ***/
const firebaseConfig = {
  apiKey: "AIzaSyC-ZMFygtySP25DTwyb3CKU1D2dgO9zJJo",
  authDomain: "ustracker-2798c.firebaseapp.com",
  projectId: "ustracker-2798c",
  storageBucket: "ustracker-2798c.firebasestorage.app",
  messagingSenderId: "671900887532",
  appId: "1:671900887532:web:5f5f3b50c451957e37f8c9",
  measurementId: "G-51GLBVT503"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firebase
let db = null;
const isFirebaseEnabled = firebaseConfig.apiKey !== "";
if (isFirebaseEnabled) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

// --- COMPONENTS ---

// 1. HOME SCREEN
const HomeScreen = ({ onNavigate }) => (
  <div className="flex flex-col items-center justify-center min-h-[80vh] space-y-8 animate-in fade-in duration-500">
    <div className="relative w-48 h-48 rounded-full overflow-hidden border-4 border-white shadow-2xl">
      <img 
        src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop" 
        alt="Us" 
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-rose-500/50 to-transparent flex items-end justify-center pb-4">
        <span className="text-white font-bold text-lg drop-shadow-md">Krish & Shrutisri</span>
      </div>
    </div>

    <div className="w-full max-w-xs space-y-4">
      <MenuButton 
        icon={<Check size={24} />} 
        label="Habit Tracker" 
        sub="Krish vs Shrutisri"
        onClick={() => onNavigate('habits')} 
        color="bg-rose-50 text-rose-600 hover:bg-rose-100"
      />
      <MenuButton 
        icon={<Camera size={24} />} 
        label="Memory Jar" 
        sub="4 memories at a time"
        onClick={() => onNavigate('memories')} 
        color="bg-indigo-50 text-indigo-600 hover:bg-indigo-100"
      />
      <MenuButton 
        icon={<Utensils size={24} />} 
        label="Dinner Picker TURDDDD BURGER" 
        sub="Real spots nearby"
        onClick={() => onNavigate('food')} 
        color="bg-orange-50 text-orange-600 hover:bg-orange-100"
      />
    </div>
  </div>
);

const MenuButton = ({ icon, label, sub, onClick, color }) => (
  <button 
    onClick={onClick}
    className={`w-full p-4 rounded-2xl flex items-center gap-4 transition-all active:scale-95 shadow-sm border border-slate-100 ${color}`}
  >
    <div className="bg-white p-3 rounded-full shadow-sm">{icon}</div>
    <div className="text-left">
      <h3 className="font-bold text-lg">{label}</h3>
      <p className="text-xs opacity-70">{sub}</p>
    </div>
    <ArrowRight className="ml-auto opacity-50" size={20} />
  </button>
);

// 2. HABIT TRACKER (Dual User)
const HabitTracker = () => {
  const [currentUser, setCurrentUser] = useState("Krish"); // Default view
  const [habits, setHabits] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");

  // Load Data
  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "habits"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
    } else {
      const saved = localStorage.getItem('us-habits');
      if (saved) setHabits(JSON.parse(saved));
    }
  }, []);

  // Sync Local if no Firebase
  useEffect(() => {
    if (!isFirebaseEnabled) localStorage.setItem('us-habits', JSON.stringify(habits));
  }, [habits]);

  const addHabit = async () => {
    if (!newName.trim()) return;
    const newHabit = {
      name: newName, 
      emoji: newEmoji, 
      streak: 0, 
      completedDates: [],
      owner: currentUser,
      createdAt: isFirebaseEnabled ? serverTimestamp() : new Date().toISOString()
    };

    if (isFirebaseEnabled && db) await addDoc(collection(db, "habits"), newHabit);
    else setHabits([ { ...newHabit, id: Date.now().toString() }, ...habits]);
    
    setNewName(""); setShowAdd(false);
  };

  const toggleHabit = async (habit) => {
    if (habit.owner !== currentUser) return; 

    const today = new Date().toISOString().split('T')[0];
    const isDone = habit.completedDates.includes(today);
    const newDates = isDone ? habit.completedDates.filter(d => d !== today) : [...habit.completedDates, today];
    const newStreak = isDone ? Math.max(0, habit.streak - 1) : habit.streak + 1;

    if (isFirebaseEnabled && db) {
      await updateDoc(doc(db, "habits", habit.id), { completedDates: newDates, streak: newStreak });
    } else {
      setHabits(habits.map(h => h.id === habit.id ? { ...h, completedDates: newDates, streak: newStreak } : h));
    }
  };

  const myHabits = habits.filter(h => h.owner === currentUser);
  const otherUser = currentUser === "Krish" ? "Shrutisri" : "Krish";
  const partnerHabits = habits.filter(h => h.owner === otherUser);

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-white p-2 rounded-xl flex gap-1 shadow-sm border border-slate-100 mb-4">
        {["Krish", "Shrutisri"].map(user => (
          <button
            key={user}
            onClick={() => setCurrentUser(user)}
            className={`flex-1 py-2 rounded-lg text-sm font-bold transition-colors ${
              currentUser === user 
                ? 'bg-rose-500 text-white shadow-md' 
                : 'text-slate-400 hover:bg-slate-50'
            }`}
          >
            {user}
          </button>
        ))}
      </div>

      <div className="bg-rose-100 p-6 rounded-2xl mb-2">
        <h2 className="text-rose-800 font-bold text-xl flex items-center gap-2">
          <Check size={20}/> {currentUser}'s Goals
        </h2>
        <p className="text-rose-600 text-sm opacity-80">
          {currentUser === "Krish" ? "Let's get it!" : "Go Shrutisri!"}
        </p>
      </div>

      <div className="space-y-3">
        {myHabits.length === 0 && (
          <div className="text-center py-8 text-slate-400">No habits yet for {currentUser}. Add one!</div>
        )}
        
        {myHabits.map(habit => {
          const isDone = habit.completedDates.includes(new Date().toISOString().split('T')[0]);
          return (
            <div key={habit.id} onClick={() => toggleHabit(habit)} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${isDone ? 'bg-rose-500 text-white shadow-lg' : 'bg-white border border-slate-100'}`}>
              <div className="flex items-center gap-4">
                <span className="text-2xl">{habit.emoji}</span>
                <div>
                  <h3 className="font-bold">{habit.name}</h3>
                  <div className={`text-xs ${isDone ? 'text-rose-100' : 'text-slate-400'}`}>{habit.streak} day streak</div>
                </div>
              </div>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isDone ? 'bg-white text-rose-500 border-white' : 'border-slate-200'}`}>
                <Check size={16} strokeWidth={4} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-8 pt-6 border-t border-slate-200">
        <h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4 px-2">
          {otherUser}'s Progress
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {partnerHabits.map(habit => {
             const isDone = habit.completedDates.includes(new Date().toISOString().split('T')[0]);
             return (
               <div key={habit.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 opacity-80">
                 <div className="flex justify-between items-start mb-2">
                    <span className="text-xl">{habit.emoji}</span>
                    {isDone && <Check size={14} className="text-green-500" />}
                 </div>
                 <div className="text-xs font-bold text-slate-700 truncate">{habit.name}</div>
                 <div className="text-[10px] text-slate-400">{habit.streak} day streak</div>
               </div>
             )
          })}
          {partnerHabits.length === 0 && <div className="text-xs text-slate-300 italic col-span-2">No habits for {otherUser} yet.</div>}
        </div>
      </div>

      <button onClick={() => setShowAdd(true)} className="fixed bottom-6 right-6 bg-rose-600 text-white p-4 rounded-full shadow-xl">
        <Plus size={24} />
      </button>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6">
            <h3 className="font-bold text-lg mb-4">Add Habit for {currentUser}</h3>
            <input 
              value={newName} onChange={e => setNewName(e.target.value)}
              placeholder="Habit name..." className="w-full p-3 bg-slate-50 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-rose-500"
            />
            <div className="flex gap-2 mb-6">
              {['✨', '🏃', '💧', '📚', '🧘', '💕'].map(e => (
                <button key={e} onClick={() => setNewEmoji(e)} className={`p-2 rounded-lg ${newEmoji === e ? 'bg-rose-100' : 'bg-slate-50'}`}>{e}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-500">Cancel</button>
              <button onClick={addHabit} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// 3. MEMORY JAR (4-Grid Slideshow)
const MemoryJar = () => {
  const [memories, setMemories] = useState([
    { id: 1, url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&q=80', caption: 'Sample 1' },
    { id: 2, url: 'https://images.unsplash.com/photo-1522673607200-164530111d74?w=400&q=80', caption: 'Sample 2' },
    { id: 3, url: 'https://images.unsplash.com/photo-1530103862676-de3c9da59af7?w=400&q=80', caption: 'Sample 3' },
    { id: 4, url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=400&q=80', caption: 'Sample 4' },
    { id: 5, url: 'https://images.unsplash.com/photo-1529619768328-e37af76c6fe5?w=400&q=80', caption: 'Sample 5' },
  ]);
  const [page, setPage] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  // Firebase Sync for Memories
  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "memories"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      });
    }
  }, []);

  // Rotate pages every 5 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPage(prev => {
        const totalPages = Math.ceil(memories.length / 4);
        return (prev + 1) % (totalPages || 1);
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [memories.length]);

  const addMemory = async () => {
    if (!newUrl) return;
    const memory = { url: newUrl, caption: "New Memory", createdAt: serverTimestamp() };
    if (isFirebaseEnabled && db) {
      await addDoc(collection(db, "memories"), memory);
    } else {
      setMemories([memory, ...memories]);
    }
    setNewUrl(""); setShowInput(false);
  };

  const currentItems = memories.slice(page * 4, (page * 4) + 4);

  return (
    <div className="h-[80vh] flex flex-col">
      <div className="bg-indigo-100 p-6 rounded-2xl mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-indigo-900 font-bold text-xl">Memory Grid</h2>
          <p className="text-indigo-600 text-sm">Showing 4 at a time.</p>
        </div>
        <button onClick={() => setShowInput(!showInput)} className="bg-white p-2 rounded-full text-indigo-600 shadow-sm"><Plus size={20}/></button>
      </div>

      {showInput && (
        <div className="mb-4 flex gap-2 animate-in slide-in-from-top-2">
          <input 
            value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="Paste image URL here..." 
            className="flex-1 p-3 bg-white border border-indigo-100 rounded-xl text-sm"
          />
          <button onClick={addMemory} className="bg-indigo-600 text-white px-4 rounded-xl font-bold">Add</button>
        </div>
      )}

      {/* 2x2 Grid */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 pb-8">
        {Array.from({ length: 4 }).map((_, i) => {
          const item = currentItems[i];
          return (
            <div key={i} className="relative rounded-2xl overflow-hidden bg-slate-200 shadow-sm border border-white">
              {item ? (
                <>
                  <img src={item.url} alt="Memory" className="w-full h-full object-cover animate-in fade-in duration-700" />
                  {item.caption && (
                    <div className="absolute bottom-0 inset-x-0 bg-black/50 p-1">
                      <p className="text-white text-[10px] text-center truncate">{item.caption}</p>
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300">
                  <Heart size={24} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-center gap-1 mb-4">
        {Array.from({ length: Math.ceil(memories.length / 4) }).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === page ? 'bg-indigo-500' : 'bg-slate-200'}`} />
        ))}
      </div>
    </div>
  );
};

// 4. FOOD SWIPER (Smart Image Selection)
const FoodSwiper = () => {
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);

  const fallbackCuisines = [
    { id: '1', name: "Mario's Trattoria (Demo)", type: 'Italian', img: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=600&fit=crop' },
    { id: '2', name: 'Sushi Zen (Demo)', type: 'Japanese', img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&fit=crop' },
  ];

  // --- SMART IMAGE LOGIC ---
  const getSmartImage = (name, type) => {
    const text = (name + " " + type).toLowerCase();
    
    // Map keywords to specific high-quality Unsplash Images
    if (text.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80';
    if (text.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80';
    if (text.includes('sushi') || text.includes('japanese')) return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80';
    if (text.includes('coffee') || text.includes('starbucks') || text.includes('cafe')) return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80';
    if (text.includes('taco') || text.includes('mexican')) return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80';
    if (text.includes('chinese') || text.includes('asian')) return 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&q=80';
    if (text.includes('indian')) return 'https://images.unsplash.com/photo-1585937421612-70a008356f36?w=600&q=80';
    if (text.includes('ice cream') || text.includes('dessert')) return 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80';

    // Random generic food backups if no keyword match
    const generics = [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80', // Restaurant interior
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', // Fancy plating
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', // Food spread
    ];
    // Pick based on name length to be consistent (not random every re-render)
    return generics[name.length % generics.length];
  };

  const searchPlacesInArea = async (lat, lon) => {
      try {
          const query = `
            [out:json][timeout:25];
            (
              node["amenity"~"restaurant|cafe|bar|fast_food"](around:5000,${lat},${lon});
              way["amenity"~"restaurant|cafe|bar|fast_food"](around:5000,${lat},${lon});
            );
            out center 20; 
          `;
          
          const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
          const data = await response.json();
          
          if (data.elements && data.elements.length > 0) {
            const realPlaces = data.elements
              .filter(el => el.tags && el.tags.name)
              .map(el => {
                const name = el.tags.name;
                const type = el.tags.cuisine || el.tags.amenity || "Restaurant";
                return {
                  id: el.id,
                  name: name,
                  type: type,
                  lat: el.lat || el.center.lat,
                  lon: el.lon || el.center.lon,
                  img: getSmartImage(name, type) // <--- USING SMART IMAGE HERE
                };
              });
            
            const shuffled = realPlaces.sort(() => 0.5 - Math.random());
            setPlaces(shuffled.length > 0 ? shuffled : fallbackCuisines);
            setError(null);
          } else {
            setPlaces(fallbackCuisines);
            setError("No places found.");
          }
      } catch (err) {
          console.error("API Error:", err);
          setPlaces(fallbackCuisines);
          setError("Could not load real data.");
      } finally {
          setLoading(false);
      }
  };

  const fetchNearbyPlaces = () => {
    setLoading(true);
    setError(null);

    // Default to Chino Hills/Sunnyvale area if no GPS
    const defaultLoc = { lat: 33.9931, lon: -117.7553 }; // Chino Hills approx

    if (!navigator.geolocation) {
      setError("Using Chino Hills (Location not supported)");
      searchPlacesInArea(defaultLoc.lat, defaultLoc.lon);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        searchPlacesInArea(position.coords.latitude, position.coords.longitude);
      },
      (err) => {
        console.error("Geo Error:", err.message);
        setError("Using Chino Hills (Location denied)");
        searchPlacesInArea(defaultLoc.lat, defaultLoc.lon);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  useEffect(() => {
    fetchNearbyPlaces();
  }, []);

  const current = places[index] || fallbackCuisines[0];

  const handleSwipe = (direction) => {
    if (direction === 'right') {
      const queryName = encodeURIComponent(current.name + " restaurant");
      const url = `https://www.google.com/maps/search/?api=1&query=${queryName}`;
      window.open(url, '_blank');
    } else {
      setIndex((prev) => (prev + 1) % places.length);
    }
  };

  return (
    <div className="h-[75vh] flex flex-col">
      <div className="bg-orange-100 p-6 rounded-2xl mb-6 flex justify-between items-center">
        <div>
          <h2 className="text-orange-900 font-bold text-xl">Nearby Eats</h2>
          <p className="text-orange-700 text-sm">
            {loading ? "Scanning area..." : error ? error : `Found ${places.length} spots`}
          </p>
        </div>
        <button onClick={fetchNearbyPlaces} className="bg-white p-2 rounded-full text-orange-600 shadow-sm active:scale-95 transition-transform">
          <RefreshCw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl border border-slate-100">
            <div className="text-center">
              <MapPin className="mx-auto text-orange-400 mb-2 animate-bounce" size={40}/>
              <p className="text-slate-400">Finding good food...</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col">
            <div className="h-3/4 bg-slate-200 relative">
               <img 
                 src={current.img} 
                 alt={current.name} 
                 className="w-full h-full object-cover" 
               />
               <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20">
                  <h1 className="text-3xl font-bold text-white leading-tight">{current.name}</h1>
                  <p className="text-white/80 text-sm mt-1 capitalize flex items-center gap-1">
                    <MapPin size={12}/> {current.type.replace(/_/g, ' ')}
                  </p>
               </div>
            </div>
            <div className="flex-1 flex items-center justify-center gap-8 bg-white">
              <button 
                onClick={() => handleSwipe('left')}
                className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={32} />
              </button>
              <button 
                onClick={() => handleSwipe('right')}
                className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-200 hover:scale-110 transition-transform"
              >
                <Heart size={36} fill="white" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState('home');

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      
      {/* Top Bar */}
      {view !== 'home' && (
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center z-10">
          <button 
            onClick={() => setView('home')}
            className="p-2 rounded-full hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-slate-600" />
          </button>
          <span className="ml-2 font-bold text-lg capitalize">
            {view === 'food' ? 'Dinner' : view}
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 max-w-md mx-auto">
        {view === 'home' && <HomeScreen onNavigate={setView} />}
        {view === 'habits' && <HabitTracker />}
        {view === 'memories' && <MemoryJar />}
        {view === 'food' && <FoodSwiper />}
      </div>

    </div>
  );
}