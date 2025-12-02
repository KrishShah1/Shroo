import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Check, Plus, Calendar, CloudSun, 
  X, Camera, Utensils, ArrowLeft, MapPin, 
  RefreshCw, Gamepad2, RotateCcw,
  Navigation, Zap, Search, Play,
  Smile, Swords, AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti'; 
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, setDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, getDoc, increment 
} from "firebase/firestore";

/* ==================================================================================
   1. CONFIGURATION & INITIALIZATION
   ================================================================================== */

const firebaseConfig = {
  apiKey: "AIzaSyC-ZMFygtySP25DTwyb3CKU1D2dgO9zJJo",
  authDomain: "ustracker-2798c.firebaseapp.com",
  projectId: "ustracker-2798c",
  storageBucket: "ustracker-2798c.firebasestorage.app",
  messagingSenderId: "671900887532",
  appId: "1:671900887532:web:5f5f3b50c451957e37f8c9",
  measurementId: "G-51GLBVT503"
};

let db = null;
const isFirebaseEnabled = firebaseConfig.apiKey !== "";

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.log("Firebase already initialized or config missing");
}

/* ==================================================================================
   2. HELPER FUNCTIONS
   ================================================================================== */

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 3959; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
};

const getSmartImage = (name, type) => {
  const text = (name + " " + type).toLowerCase();
  if (text.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80';
  if (text.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80';
  if (text.includes('sushi') || text.includes('japanese')) return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80';
  if (text.includes('coffee') || text.includes('starbucks') || text.includes('cafe')) return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80';
  if (text.includes('taco') || text.includes('mexican')) return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80';
  const generics = ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80', 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80'];
  return generics[name.length % generics.length];
};

/* ==================================================================================
   3. SHARED UI
   ================================================================================== */

const MenuButtonSmall = ({ icon, label, onClick, color, fullWidth }) => (
  <button onClick={onClick} className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-sm border border-slate-100 ${color} ${fullWidth ? 'w-full flex-row' : ''}`}>
    <div className="bg-white p-2 rounded-full shadow-sm">{icon}</div>
    <span className="font-bold text-sm">{label}</span>
  </button>
);

/* ==================================================================================
   4. HOME SCREEN WIDGETS
   ================================================================================== */

const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    let lat = 33.9931; let lon = -117.7553;
    const fetchWeather = (latitude, longitude) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
        .then(res => res.json()).then(data => setWeather(Math.round(data.current.temperature_2m))).catch(err => console.log(err));
    };
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => fetchWeather(p.coords.latitude, p.coords.longitude), () => fetchWeather(lat, lon));
    else fetchWeather(lat, lon);
  }, []);
  if (!weather) return null;
  return (<div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-600 flex items-center gap-1 shadow-sm z-10"><CloudSun size={14} className="text-orange-400" />{weather}°F</div>);
};

const CountdownWidget = () => {
  // Use local time construction: Year, Month (0-11), Day
  // Dec 3rd, 2025 = (2025, 11, 3)
  const targetDate = new Date(2025, 11, 3); 
  const today = new Date(); 
  today.setHours(0,0,0,0); 
  targetDate.setHours(0,0,0,0);
  
  const diffDays = Math.ceil((targetDate - today) / (1000 * 60 * 60 * 24)); 
  const label = diffDays === 0 ? "It's Today!" : diffDays < 0 ? "Days since Anniversary" : "Days until Anniversary";
  
  return (
    <div className="bg-white/90 backdrop-blur-sm px-6 py-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
      <span className="text-2xl font-bold text-rose-500">{Math.abs(diffDays)}</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</span>
    </div>
  );
};

const DistanceWidget = ({ currentUser }) => {
  const [distance, setDistance] = useState(null);
  const [myLoc, setMyLoc] = useState(null);
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    if (navigator.geolocation) navigator.geolocation.watchPosition((p) => {
      const loc = { lat: p.coords.latitude, lng: p.coords.longitude, timestamp: serverTimestamp() };
      setMyLoc(loc); setDoc(doc(db, "locations", currentUser), loc);
    }, (err) => console.log(err), { enableHighAccuracy: true });
    const otherUser = currentUser === "Krish" ? "Shrutisri" : "Krish";
    const unsubscribe = onSnapshot(doc(db, "locations", otherUser), (docSnap) => {
      if (docSnap.exists() && myLoc) {
        const partnerLoc = docSnap.data();
        setDistance(calculateDistance(myLoc.lat, myLoc.lng, partnerLoc.lat, partnerLoc.lng).toFixed(1));
      }
    });
    return () => unsubscribe();
  }, [currentUser, myLoc]);
  return (
    <div className="bg-white/90 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 w-full max-w-xs">
      <div className="bg-blue-100 p-2 rounded-full text-blue-600"><Navigation size={20} className={distance ? "fill-blue-600" : ""} /></div>
      <div><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Love Radar</h3><p className="text-slate-800 font-bold leading-tight">{distance ? `${distance} miles apart` : "Locating..."}</p></div>
    </div>
  );
};

/* ==================================================================================
   5. FEATURE COMPONENTS
   ================================================================================== */

const HabitTracker = ({ currentUser }) => {
  const [habits, setHabits] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "habits"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => setHabits(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    }
  }, []);

  const addHabit = async () => {
    if (!newName.trim()) return;
    const newHabit = { name: newName, emoji: newEmoji, streak: 0, completedDates: [], owner: currentUser, createdAt: serverTimestamp() };
    if (isFirebaseEnabled && db) await addDoc(collection(db, "habits"), newHabit);
    setNewName(""); setShowAdd(false);
  };

  const toggleHabit = async (habit) => {
    if (habit.owner !== currentUser) return; 
    const today = new Date().toISOString().split('T')[0];
    const isDone = habit.completedDates.includes(today);
    const newDates = isDone ? habit.completedDates.filter(d => d !== today) : [...habit.completedDates, today];
    const newStreak = isDone ? Math.max(0, habit.streak - 1) : habit.streak + 1;
    if (!isDone) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#FFC0CB', '#FF69B4', '#FF1493'] });
    if (isFirebaseEnabled && db) await updateDoc(doc(db, "habits", habit.id), { completedDates: newDates, streak: newStreak });
  };

  const myHabits = habits.filter(h => h.owner === currentUser);
  const partnerHabits = habits.filter(h => h.owner === (currentUser === "Krish" ? "Shrutisri" : "Krish"));

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-rose-100 p-6 rounded-2xl mb-2"><h2 className="text-rose-800 font-bold text-xl flex items-center gap-2"><Check size={20}/> {currentUser}'s Goals</h2></div>
      <div className="space-y-3">{myHabits.map(habit => { const isDone = habit.completedDates.includes(new Date().toISOString().split('T')[0]); return ( <div key={habit.id} onClick={() => toggleHabit(habit)} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${isDone ? 'bg-rose-500 text-white shadow-lg' : 'bg-white border border-slate-100'}`}><div className="flex items-center gap-4"><span className="text-2xl">{habit.emoji}</span><div><h3 className="font-bold">{habit.name}</h3><div className={`text-xs ${isDone ? 'text-rose-100' : 'text-slate-400'}`}>{habit.streak} day streak</div></div></div><div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${isDone ? 'bg-white text-rose-500 border-white' : 'border-slate-200'}`}><Check size={16} strokeWidth={4} /></div></div> ); })}</div>
      <div className="mt-8 pt-6 border-t border-slate-200"><h3 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-4 px-2">Partner's Progress</h3><div className="grid grid-cols-2 gap-3">{partnerHabits.map(habit => { const isDone = habit.completedDates.includes(new Date().toISOString().split('T')[0]); return ( <div key={habit.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 opacity-80"><div className="flex justify-between items-start mb-2"><span className="text-xl">{habit.emoji}</span>{isDone && <Check size={14} className="text-green-500" />}</div><div className="text-xs font-bold text-slate-700 truncate">{habit.name}</div><div className="text-[10px] text-slate-400">{habit.streak} day streak</div></div> )})}</div></div>
      <button onClick={() => setShowAdd(true)} className="fixed bottom-6 right-6 bg-rose-600 text-white p-4 rounded-full shadow-xl"><Plus size={24} /></button>
      {showAdd && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"><div className="bg-white w-full max-w-sm rounded-3xl p-6"><h3 className="font-bold text-lg mb-4">Add Habit</h3><input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Habit name..." className="w-full p-3 bg-slate-50 rounded-xl mb-4 outline-none focus:ring-2 focus:ring-rose-500"/><div className="flex gap-2 mb-6">{['✨', '🏃', '💧', '📚', '🧘', '💕'].map(e => (<button key={e} onClick={() => setNewEmoji(e)} className={`p-2 rounded-lg ${newEmoji === e ? 'bg-rose-100' : 'bg-slate-50'}`}>{e}</button>))}</div><div className="flex gap-2"><button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-500">Cancel</button><button onClick={addHabit} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-bold">Create</button></div></div></div>)}
    </div>
  );
};

const MemoryJar = () => {
  const [memories, setMemories] = useState([]);
  const [page, setPage] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "memories"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        else setMemories([]);
      });
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setPage(prev => { const total = Math.ceil(memories.length / 4); return total === 0 ? 0 : (prev + 1) % total; }), 5000);
    return () => clearInterval(timer);
  }, [memories.length]);

  const addMemory = async () => {
    if (!newUrl) return;
    if (isFirebaseEnabled && db) await addDoc(collection(db, "memories"), { url: newUrl, caption: "New Memory", createdAt: serverTimestamp() });
    setNewUrl(""); setShowInput(false);
  };

  return (
    <div className="h-[80vh] flex flex-col">
      <div className="bg-indigo-100 p-6 rounded-2xl mb-6 flex justify-between items-center"><div><h2 className="text-indigo-900 font-bold text-xl">Memory Grid</h2><p className="text-indigo-600 text-sm">{memories.length > 0 ? "Showing 4 at a time." : "No memories yet."}</p></div><button onClick={() => setShowInput(!showInput)} className="bg-white p-2 rounded-full text-indigo-600 shadow-sm"><Plus size={20}/></button></div>
      {showInput && (<div className="mb-4 flex gap-2 animate-in slide-in-from-top-2"><input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="Paste image URL here..." className="flex-1 p-3 bg-white border border-indigo-100 rounded-xl text-sm"/><button onClick={addMemory} className="bg-indigo-600 text-white px-4 rounded-xl font-bold">Add</button></div>)}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 pb-8">{Array.from({ length: 4 }).map((_, i) => { const item = memories.slice(page * 4, (page * 4) + 4)[i]; return ( <div key={i} className="relative rounded-2xl overflow-hidden bg-slate-200 shadow-sm border border-white">{item ? <img src={item.url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><Heart size={24} className="opacity-20" /></div>}</div> ); })}</div>
    </div>
  );
};

const FoodSwiper = () => {
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);

  const fallbackCuisines = [
    { id: '1', name: "Mario's Trattoria (Demo)", type: 'Italian', img: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=600&fit=crop' },
    { id: '2', name: 'Sushi Zen (Demo)', type: 'Japanese', img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&fit=crop' },
  ];

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
                  id: el.id, name: name, type: type,
                  lat: el.lat || el.center.lat, lon: el.lon || el.center.lon,
                  img: getSmartImage(name, type)
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
    const defaultLoc = { lat: 33.9931, lon: -117.7553 }; 
    if (!navigator.geolocation) {
      setError("Using Chino Hills (Location not supported)");
      searchPlacesInArea(defaultLoc.lat, defaultLoc.lon);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => { searchPlacesInArea(position.coords.latitude, position.coords.longitude); },
      (err) => { console.error("Geo Error:", err.message); setError("Using Chino Hills (Location denied)"); searchPlacesInArea(defaultLoc.lat, defaultLoc.lon); },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  };

  useEffect(() => { fetchNearbyPlaces(); }, []);

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
      <div className="bg-orange-100 p-6 rounded-2xl mb-6 flex justify-between items-center"><div><h2 className="text-orange-900 font-bold text-xl">Nearby Eats</h2><p className="text-orange-700 text-sm">{loading ? "Scanning area..." : error ? error : `Found ${places.length} spots`}</p></div><button onClick={fetchNearbyPlaces} className="bg-white p-2 rounded-full text-orange-600 shadow-sm active:scale-95 transition-transform"><RefreshCw size={20} className={loading ? "animate-spin" : ""} /></button></div>
      <div className="flex-1 relative">{loading ? (<div className="absolute inset-0 flex items-center justify-center bg-white rounded-3xl border border-slate-100"><div className="text-center"><MapPin className="mx-auto text-orange-400 mb-2 animate-bounce" size={40}/><p className="text-slate-400">Finding good food...</p></div></div>) : (<div className="absolute inset-0 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"><div className="h-3/4 bg-slate-200 relative"><img src={current.img} alt={current.name} className="w-full h-full object-cover" /><div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-6 pt-20"><h1 className="text-3xl font-bold text-white leading-tight">{current.name}</h1><p className="text-white/80 text-sm mt-1 capitalize flex items-center gap-1"><MapPin size={12}/> {current.type.replace(/_/g, ' ')}</p></div></div><div className="flex-1 flex items-center justify-center gap-8 bg-white"><button onClick={() => handleSwipe('left')} className="w-16 h-16 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center hover:bg-slate-200 transition-colors"><X size={32} /></button><button onClick={() => handleSwipe('right')} className="w-20 h-20 rounded-full bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-200 hover:scale-110 transition-transform"><Heart size={36} fill="white" /></button></div></div>)}</div>
    </div>
  );
};

/* ==================================================================================
   6. GAMES (Updated Word Hunt, Charades, Kiss War)
   ================================================================================== */

const WordHunt = ({ currentUser }) => {
  const [gameState, setGameState] = useState('lobby'); 
  const [timeLeft, setTimeLeft] = useState(60);
  const [baseWord, setBaseWord] = useState("RELATIONSHIP");
  const [myWords, setMyWords] = useState([]);
  const [input, setInput] = useState("");
  const [results, setResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null); // Feedback state
  
  // Track the unique game session ID (using timestamp) to detect resets
  const lastGameTime = useRef(null);

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const unsubscribe = onSnapshot(doc(db, "games", "wordhunt"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // 1. Check for New Game Trigger
        const serverTime = data.startTime ? data.startTime.toMillis() : 0;
        if (lastGameTime.current && serverTime !== lastGameTime.current) {
            // A new game has started! Reset local state
            setMyWords([]);
            setInput("");
            setGameState('playing');
        }
        lastGameTime.current = serverTime;

        if (data.status === 'playing') {
          if (data.word) setBaseWord(data.word);
          
          // Restore words if re-joining
          if (data.submissions && data.submissions[currentUser] && myWords.length === 0) {
             setMyWords(data.submissions[currentUser]);
          }

          // Move to playing state if not already
          setGameState((prev) => {
             if (prev !== 'playing') {
                // Calculate time offset if joining late
                let elapsed = 0;
                if (data.startTime) {
                    const now = Date.now();
                    elapsed = Math.floor((now - data.startTime.toMillis()) / 1000);
                }
                setTimeLeft(Math.max(0, 60 - elapsed));
                return 'playing';
             }
             return prev;
          });
          
        } else if (data.status === 'review') {
          setGameState('review');
          setResults(data.submissions);
        } else {
          setGameState('lobby');
          setResults(null);
        }
      }
    });
    return () => unsubscribe();
  }, []); // Removed [gameState] dependency to prevent tearing down listener constantly

  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      finishRound();
    }
  }, [gameState, timeLeft]);

  // Clear error msg after 2s
  useEffect(() => {
    if (errorMsg) {
       const t = setTimeout(() => setErrorMsg(null), 2000);
       return () => clearTimeout(t);
    }
  }, [errorMsg]);

  const isValidSubset = (word, base) => {
    const wordCounts = {};
    const baseCounts = {};
    for (const char of word) wordCounts[char] = (wordCounts[char] || 0) + 1;
    for (const char of base) baseCounts[char] = (baseCounts[char] || 0) + 1;
    for (const char in wordCounts) if (!baseCounts[char] || wordCounts[char] > baseCounts[char]) return false;
    return true;
  };

  const startRound = async () => {
    const WORDS = ["RELATIONSHIP", "ADVENTURE", "HAPPINESS", "CONNECTION", "BEAUTIFUL", "ROMANTIC", "AFFECTION", "FOREVER", "MEMORIES", "TOGETHER"];
    const randomWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    
    // Reset local immediately for the starter
    setMyWords([]);
    setInput("");
    setGameState('playing');
    setTimeLeft(60);

    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "games", "wordhunt"), {
        status: 'playing',
        word: randomWord,
        startTime: serverTimestamp(), // This triggers the reset for the other user
        submissions: {} // Clear old results
      });
    }
  };

  const submitWord = async () => {
    const word = input.toUpperCase().trim();
    if (!word) return;

    if (word.length < 3) {
        setErrorMsg("Too short!");
        return;
    }
    if (myWords.includes(word)) {
        setErrorMsg("Already found!");
        return;
    }
    if (!isValidSubset(word, baseWord)) {
        setErrorMsg("Missing letters!");
        return;
    }

    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
      if (res.ok) {
        const newWords = [...myWords, word];
        setMyWords(newWords);
        setInput("");
        
        // Save to DB immediately so progress isn't lost
        if (isFirebaseEnabled && db) {
            await setDoc(doc(db, "games", "wordhunt"), {
                submissions: { [currentUser]: newWords }
            }, { merge: true });
        }
      } else {
        setErrorMsg("Not in dictionary!");
      }
    } catch (e) {
       // If API fails, fallback to accepting it to not block game
       setErrorMsg("Network error - Word accepted");
       const newWords = [...myWords, word];
       setMyWords(newWords);
       setInput("");
    }
  };

  const finishRound = async () => {
    // 1. Save local words immediately to ensure no data loss
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "games", "wordhunt"), {
        submissions: { [currentUser]: myWords }
      }, { merge: true });
    }
    
    // 2. Temporarily show waiting screen
    setGameState('waiting');

    // 3. Wait 3 seconds to let other clients sync, then FORCE the review state
    setTimeout(async () => {
         if (isFirebaseEnabled && db) {
             await updateDoc(doc(db, "games", "wordhunt"), { status: 'review' });
         }
    }, 3000);
  };

  const checkResults = async () => {
    if (isFirebaseEnabled && db) await updateDoc(doc(db, "games", "wordhunt"), { status: 'review' });
  };

  if (gameState === 'lobby') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-3xl font-black text-pink-500 mb-4">Word Hunt</h2>
        <p className="text-slate-500 mb-8">60 seconds to find as many words as you can!</p>
        <button onClick={startRound} className="bg-pink-500 text-white px-8 py-4 rounded-2xl font-bold text-xl shadow-xl active:scale-95 transition-transform flex items-center gap-2">
          <Play fill="white"/> Start Game
        </button>
      </div>
    );
  }

  if (gameState === 'playing') {
    return (
      <div className="h-[80vh] flex flex-col items-center">
        <div className="w-full flex justify-between items-center mb-6">
          <div className={`px-4 py-2 rounded-xl font-bold ${timeLeft < 10 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'}`}>{timeLeft}s</div>
          <div className="font-bold text-pink-500">{myWords.length} words</div>
        </div>
        <div className="text-4xl font-black tracking-widest text-slate-800 mb-8 break-all text-center">{baseWord}</div>
        <div className="flex gap-2 w-full mb-2">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitWord()} className={`flex-1 p-4 rounded-xl border-2 text-lg font-bold uppercase outline-none focus:border-pink-500 transition-colors ${errorMsg ? 'border-red-500 bg-red-50' : 'border-slate-200'}`} placeholder="Type word..." autoFocus />
          <button onClick={submitWord} className="bg-pink-500 text-white p-4 rounded-xl font-bold active:scale-95 transition-transform"><Plus /></button>
        </div>
        <div className="h-6 mb-4 text-red-500 text-xs font-bold w-full text-center flex items-center justify-center gap-1">
            {errorMsg && <><AlertCircle size={12}/> {errorMsg}</>}
        </div>
        <div className="flex-1 w-full bg-slate-50 rounded-2xl p-4 overflow-y-auto content-start flex flex-wrap gap-2">
          {myWords.slice().reverse().map((w, i) => <span key={i} className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-slate-700 font-bold">{w}</span>)}
        </div>
      </div>
    );
  }

  if (gameState === 'waiting') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-2xl font-bold text-slate-700 mb-2">Time's Up!</h2>
        <p className="text-slate-500 mb-8">Syncing results...</p>
        <div className="animate-spin text-pink-500 mb-8"><RefreshCw size={40}/></div>
        <button onClick={checkResults} className="text-xs text-slate-400 font-bold uppercase tracking-wider underline">Force Show Results</button>
      </div>
    );
  }

  return (
    <div className="h-[80vh] flex flex-col">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-pink-600">Results</h2>
        <button onClick={startRound} className="text-sm text-slate-400 font-bold underline mt-2">Play Again</button>
      </div>
      <div className="grid grid-cols-2 gap-4 h-full overflow-y-auto">
        {results && Object.entries(results).map(([user, words]) => (
          <div key={user} className="bg-slate-50 p-4 rounded-2xl">
            <h3 className="font-bold text-slate-700 mb-2 border-b pb-2">{user} ({words.length})</h3>
            <div className="flex flex-col gap-1">
              {words.map((w, i) => <span key={i} className="text-xs font-medium text-slate-500">{w}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const EmojiCharades = ({ currentUser }) => {
  const PUZZLES = [
    { emojis: "🦁👑", answer: "The Lion King", hints: ["Disney Movie", "Simba"] },
    { emojis: "⚡️👓🧙‍♂️", answer: "Harry Potter", hints: ["Wizard", "Hogwarts"] },
    { emojis: "🚢🧊🎻", answer: "Titanic", hints: ["Leonardo DiCaprio", "Iceberg"] },
    { emojis: "🕸️🕷️🦸‍♂️", answer: "Spiderman", hints: ["Marvel", "Peter Parker"] },
    { emojis: "🦖🦕🚙", answer: "Jurassic Park", hints: ["Dinosaurs", "Theme Park"] },
    { emojis: "👻🚫", answer: "Ghostbusters", hints: ["Who you gonna call?", "Slime"] },
    { emojis: "👽🚲🌕", answer: "ET", hints: ["Phone Home", "Steven Spielberg"] },
    { emojis: "🐼🥋", answer: "Kung Fu Panda", hints: ["Jack Black", "Noodles"] },
    { emojis: "🎩🍫🏭", answer: "Charlie and the Chocolate Factory", hints: ["Willy Wonka", "Golden Ticket"] },
    { emojis: "🤡🎈", answer: "It", hints: ["Stephen King", "Pennywise"] },
    { emojis: "☂️💃", answer: "Mary Poppins", hints: ["Supercalifragilistic", "Nanny"] },
    { emojis: "🥊🐯", answer: "Rocky", hints: ["Eye of the Tiger", "Boxing"] },
    { emojis: "🏴‍☠️🦜🚢", answer: "Pirates of the Caribbean", hints: ["Jack Sparrow", "Black Pearl"] },
    { emojis: "🧸🤠🚀", answer: "Toy Story", hints: ["Woody & Buzz", "Pixar"] },
    { emojis: "🦈🏖️😱", answer: "Jaws", hints: ["Shark", "Bigger Boat"] },
    { emojis: "💍🌋👣", answer: "Lord of the Rings", hints: ["Precious", "Hobbit"] },
    { emojis: "🦇👨", answer: "Batman", hints: ["Gotham", "Joker"] },
    { emojis: "🧜‍♀️🦀🔱", answer: "The Little Mermaid", hints: ["Under the Sea", "Ariel"] },
    { emojis: "👠🦁🤖🌪️", answer: "The Wizard of Oz", hints: ["Dorothy", "Yellow Brick Road"] },
    { emojis: "👸👹🌹", answer: "Beauty and the Beast", hints: ["Be Our Guest", "Gaston"] },
    { emojis: "👨‍🍳🐀🇫🇷", answer: "Ratatouille", hints: ["Cooking Rat", "Paris"] },
    { emojis: "🧊❄️👸", answer: "Frozen", hints: ["Let It Go", "Elsa"] },
    { emojis: "🎸💀🕯️", answer: "Coco", hints: ["Day of the Dead", "Remember Me"] },
    { emojis: "🚗💨🏁", answer: "Cars", hints: ["Lightning McQueen", "Kachow"] },
    { emojis: "🎈🏠👴", answer: "Up", hints: ["Balloons", "Squirrel!"] },
    { emojis: "🔎🐠", answer: "Finding Nemo", hints: ["Clownfish", "Dory"] },
    { emojis: "🔨⚡️", answer: "Thor", hints: ["Avenger", "Asgard"] },
    { emojis: "🛡️🇺🇸", answer: "Captain America", hints: ["First Avenger", "Steve Rogers"] },
    { emojis: "🟢💪", answer: "Hulk", hints: ["Smash", "Bruce Banner"] },
    { emojis: "🤖❤️", answer: "Iron Man", hints: ["Tony Stark", "Suit"] },
    { emojis: "🐜👨", answer: "Ant Man", hints: ["Small", "Paul Rudd"] },
    { emojis: "🏹🔥👊", answer: "Hunger Games", hints: ["Katniss", "District 12"] },
    { emojis: "🍫🏃‍♂️", answer: "Forrest Gump", hints: ["Run Forrest Run", "Box of Chocolates"] },
    { emojis: "👽📞🏠", answer: "Arrival", hints: ["Aliens", "Language"] },
    { emojis: "🕰️🚗🔥", answer: "Back to the Future", hints: ["Marty McFly", "88 MPH"] },
    { emojis: "🕶️💊🐇", answer: "The Matrix", hints: ["Red Pill", "Neo"] },
    { emojis: "🦕🏞️", answer: "The Land Before Time", hints: ["Littlefoot", "Longneck"] },
    { emojis: "🦁🦓🦒🦛", answer: "Madagascar", hints: ["Move It Move It", "Zoo"] },
    { emojis: "🐼🎋", answer: "Turning Red", hints: ["Panda", "Boy Band"] },
    { emojis: "👹🤢🤮", answer: "Shrek", hints: ["Donkey", "Swamp"] },
    { emojis: "🐝🍯", answer: "Bee Movie", hints: ["Jerry Seinfeld", "Jazz"] },
    { emojis: "🥋👊🐍", answer: "Karate Kid", hints: ["Wax On Wax Off", "Cobra Kai"] },
    { emojis: "🧛‍♂️🐺💔", answer: "Twilight", hints: ["Edward & Bella", "Sparkle"] },
    { emojis: "🧟‍♂️🧟‍♀️", answer: "Walking Dead", hints: ["Zombies", "Rick Grimes"] },
    { emojis: "🐉👑🔥", answer: "Game of Thrones", hints: ["Winter is Coming", "Iron Throne"] },
    { emojis: "🧪⚗️👴👦", answer: "Rick and Morty", hints: ["Wubba Lubba Dub Dub", "Portal Gun"] },
    { emojis: "🍩👮‍♂️", answer: "The Simpsons", hints: ["Homer", "Springfield"] },
    { emojis: "🐢🍕🐀", answer: "Ninja Turtles", hints: ["Leonardo", "Cowabunga"] },
    { emojis: "👻🥒", answer: "VeggieTales", hints: ["Tomato", "Cucumber"] },
    { emojis: "🧽🍍🦀", answer: "SpongeBob", hints: ["Bikini Bottom", "SquarePants"] }
  ];

  const [currentIdx, setCurrentIdx] = useState(0);
  const [guess, setGuess] = useState("");
  const [hintLevel, setHintLevel] = useState(0);
  const [solved, setSolved] = useState(false);

  // Sync Current Puzzle
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const unsubscribe = onSnapshot(doc(db, "games", "charades"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCurrentIdx(data.currentIdx || 0);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGuess = () => {
    const puzzle = PUZZLES[currentIdx];
    if (guess.toLowerCase().trim() === puzzle.answer.toLowerCase()) {
      setSolved(true);
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    } else {
      alert("Try again!");
    }
  };

  const nextPuzzle = async () => {
    setSolved(false);
    setGuess("");
    setHintLevel(0);
    const next = Math.floor(Math.random() * PUZZLES.length);
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "games", "charades"), { currentIdx: next }, { merge: true });
    } else {
      setCurrentIdx(next);
    }
  };

  const puzzle = PUZZLES[currentIdx] || PUZZLES[0]; 

  return (
    <div className="h-[80vh] flex flex-col items-center justify-center p-6 space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-yellow-600 mb-2">Emoji Charades</h2>
        <p className="text-slate-400 text-xs uppercase tracking-widest">Puzzle {currentIdx + 1}</p>
      </div>

      <div className="text-6xl animate-bounce py-8">{puzzle.emojis}</div>

      {!solved ? (
        <div className="w-full space-y-4">
          <input 
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            className="w-full p-4 rounded-xl border-2 border-yellow-100 text-center font-bold text-lg outline-none focus:border-yellow-500"
            placeholder="What is it?"
          />
          <button onClick={handleGuess} className="w-full bg-yellow-500 text-white p-4 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">
            Submit Guess
          </button>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setHintLevel(h => Math.min(h + 1, 2))}
              className="flex-1 bg-yellow-50 text-yellow-600 p-3 rounded-xl font-bold text-sm"
            >
              Need a Hint? ({2 - hintLevel} left)
            </button>
            <button 
              onClick={nextPuzzle}
              className="px-4 bg-slate-100 text-slate-400 rounded-xl font-bold"
            >
              Skip
            </button>
          </div>

          {hintLevel > 0 && (
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 text-yellow-800 text-sm font-medium text-center">
              💡 {puzzle.hints[0]}
              {hintLevel > 1 && <br/>}{hintLevel > 1 && `💡 ${puzzle.hints[1]}`}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4 animate-in zoom-in">
          <div className="text-green-500 font-black text-3xl">CORRECT!</div>
          <div className="text-slate-800 font-medium text-xl">{puzzle.answer}</div>
          <button onClick={nextPuzzle} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl">
            Next Puzzle
          </button>
        </div>
      )}
    </div>
  );
};

const KissWar = ({ currentUser }) => {
  const [gameState, setGameState] = useState('lobby'); 
  const [scores, setScores] = useState({ Krish: 0, Shrutisri: 0 });
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const unsubscribe = onSnapshot(doc(db, "games", "kisswar"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGameState(data.status);
        setScores(data.scores || { Krish: 0, Shrutisri: 0 });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (gameState === 'playing' && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (gameState === 'playing' && timeLeft === 0) {
      if (isFirebaseEnabled && db) updateDoc(doc(db, "games", "kisswar"), { status: 'finished' });
    }
  }, [gameState, timeLeft]);

  const startGame = async () => {
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "games", "kisswar"), { 
        status: 'playing', 
        scores: { Krish: 0, Shrutisri: 0 },
        startTime: serverTimestamp()
      });
      setTimeLeft(10);
    }
  };

  const handleTap = () => {
    if (gameState !== 'playing') return;
    if (isFirebaseEnabled && db) {
      updateDoc(doc(db, "games", "kisswar"), {
        [`scores.${currentUser}`]: increment(1)
      });
    }
  };

  const total = scores.Krish + scores.Shrutisri;
  const krishPercent = total === 0 ? 50 : (scores.Krish / total) * 100;

  if (gameState === 'lobby') {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <h2 className="text-4xl font-black text-rose-500 mb-2">KISS WAR</h2>
        <p className="text-slate-500 mb-8">Tap as fast as you can for 10s!</p>
        <button onClick={startGame} className="bg-rose-500 text-white px-8 py-4 rounded-full font-bold text-xl shadow-xl active:scale-95 transition-transform">
          START WAR
        </button>
      </div>
    );
  }

  if (gameState === 'finished') {
    const winner = scores.Krish > scores.Shrutisri ? "Krish" : scores.Shrutisri > scores.Krish ? "Shrutisri" : "Tie";
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <h2 className="text-3xl font-black text-slate-800">WINNER</h2>
        <div className="text-5xl font-black text-rose-500 animate-bounce">{winner}</div>
        <div className="flex gap-8 text-xl font-bold text-slate-600">
          <div>K: {scores.Krish}</div>
          <div>S: {scores.Shrutisri}</div>
        </div>
        <button onClick={startGame} className="text-sm font-bold text-slate-400 underline">Rematch</button>
      </div>
    );
  }

  return (
    <div className="h-[80vh] flex flex-col overflow-hidden">
      <div className="h-16 w-full flex text-white font-bold text-xl relative">
        <div className="bg-blue-500 flex items-center justify-center transition-all duration-100" style={{ width: `${krishPercent}%` }}>
          {scores.Krish}
        </div>
        <div className="bg-rose-500 flex items-center justify-center transition-all duration-100 flex-1">
          {scores.Shrutisri}
        </div>
        
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white text-slate-900 rounded-full w-10 h-10 flex items-center justify-center shadow-lg text-xs font-black border-4 border-slate-900 z-10">
          VS
        </div>
      </div>

      <div className="text-center py-4">
        <span className="text-4xl font-black text-slate-200">{timeLeft}</span>
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <button 
          onPointerDown={handleTap} 
          className="w-64 h-64 rounded-full bg-rose-500 text-white shadow-[0_10px_0_rgb(190,18,60)] active:shadow-none active:translate-y-[10px] transition-all flex items-center justify-center"
        >
          <span className="text-6xl">💋</span>
        </button>
      </div>
      <p className="text-center text-slate-400 text-sm font-bold pb-8 uppercase tracking-widest">Tap Fast!</p>
    </div>
  );
};

const ThisOrThat = ({ currentUser }) => {
  const DEFAULT_QUESTIONS = [["Beach Vacation", "Mountain Cabin"], ["Night In", "Night Out"], ["Save Money", "Spend Money"], ["Horror Movie", "Comedy Movie"], ["Sunrise", "Sunset"], ["Coffee", "Tea"], ["Summer", "Winter"], ["Dogs", "Cats"]];
  const [questions, setQuestions] = useState(DEFAULT_QUESTIONS);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [votes, setVotes] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [newOptionA, setNewOptionA] = useState("");
  const [newOptionB, setNewOptionB] = useState("");

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const gameRef = doc(db, "games", "thisorthat");
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentQIndex(data.currentQIndex || 0);
        setVotes(data.votes || {});
        let loadedCustom = [];
        if (data.customQuestions && Array.isArray(data.customQuestions)) {
            loadedCustom = data.customQuestions.map(q => {
                if (Array.isArray(q)) return q; 
                return [q.a, q.b];
            });
        }
        setQuestions([...DEFAULT_QUESTIONS, ...loadedCustom]);

        if (data.votes && data.votes['Krish'] !== undefined && data.votes['Shrutisri'] !== undefined) {
           if (data.votes['Krish'] === data.votes['Shrutisri']) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
      } else {
        setDoc(gameRef, { currentQIndex: 0, votes: {}, customQuestions: [] });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleVote = async (choiceIndex) => {
    if (!isFirebaseEnabled || !db) return;
    const newVotes = { ...votes, [currentUser]: choiceIndex };
    setVotes(newVotes);
    await updateDoc(doc(db, "games", "thisorthat"), { votes: newVotes });
  };

  const nextQuestion = async () => {
    if (!isFirebaseEnabled || !db) return;
    const nextIndex = Math.floor(Math.random() * questions.length);
    await updateDoc(doc(db, "games", "thisorthat"), { currentQIndex: nextIndex, votes: {} });
  };

  const addCustomQuestion = async () => {
    if (!newOptionA.trim() || !newOptionB.trim()) return;
    if (isFirebaseEnabled && db) {
      const gameRef = doc(db, "games", "thisorthat");
      const docSnap = await getDoc(gameRef);
      const currentCustom = docSnap.exists() ? (docSnap.data().customQuestions || []) : [];
      await updateDoc(gameRef, { 
        customQuestions: [...currentCustom, { a: newOptionA, b: newOptionB }] 
      });
    }
    setNewOptionA("");
    setNewOptionB("");
    setShowAdd(false);
  };

  const myVote = votes[currentUser];
  const partnerUser = currentUser === "Krish" ? "Shrutisri" : "Krish";
  const partnerVote = votes[partnerUser];
  const bothVoted = myVote !== undefined && partnerVote !== undefined;
  
  const currentQuestion = questions[currentQIndex] || ["Loading...", "Loading..."];

  return (
    <div className="h-[75vh] flex flex-col items-center justify-center space-y-8 relative">
      <div className="absolute top-0 right-0">
        <button onClick={() => setShowAdd(true)} className="bg-purple-100 text-purple-600 p-2 rounded-full shadow-sm"><Plus size={20}/></button>
      </div>
      
      <div className="text-center"><h2 className="text-2xl font-bold text-rose-500 mb-2">This or That?</h2><p className="text-slate-400 text-sm">Do you match?</p></div>
      <div className="w-full space-y-4">{currentQuestion.map((option, idx) => (<button key={idx} onClick={() => handleVote(idx)} className={`w-full p-6 rounded-2xl border-2 text-lg font-bold transition-all ${myVote === idx ? 'bg-rose-500 text-white border-rose-500 shadow-lg scale-105' : 'bg-white border-slate-100 text-slate-700 hover:border-rose-200'}`}>{option}{bothVoted && partnerVote === idx && (<span className="ml-2 text-sm bg-white/20 px-2 py-1 rounded-full">{partnerUser} too!</span>)}</button>))}</div>
      {bothVoted && (<div className="animate-in fade-in slide-in-from-bottom-4 text-center"><p className="text-lg font-bold mb-4">{myVote === partnerVote ? "🎉 It's a Match!" : "😬 Opposites Attract?"}</p><button onClick={nextQuestion} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform">Next Question</button></div>)}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-sm rounded-3xl p-6">
            <h3 className="font-bold text-lg mb-4 text-slate-800">Add New Question</h3>
            <input value={newOptionA} onChange={e => setNewOptionA(e.target.value)} placeholder="Option A (e.g. Pizza)" className="w-full p-3 bg-slate-50 rounded-xl mb-3 border border-slate-200 outline-none focus:border-purple-500"/>
            <div className="text-center text-slate-400 font-bold text-xs mb-3">VS</div>
            <input value={newOptionB} onChange={e => setNewOptionB(e.target.value)} placeholder="Option B (e.g. Burger)" className="w-full p-3 bg-slate-50 rounded-xl mb-6 border border-slate-200 outline-none focus:border-purple-500"/>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-3 text-slate-500 font-bold">Cancel</button>
              <button onClick={addCustomQuestion} className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LoveTicTacToe = ({ currentUser }) => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const gameRef = doc(db, "games", "tictactoe");
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setBoard(data.board);
        setIsXNext(data.isXNext);
        if (data.winner && data.winner !== winner) {
           setWinner(data.winner);
           confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        } else {
           setWinner(data.winner);
        }
      } else {
        setDoc(gameRef, { board: Array(9).fill(null), isXNext: true, winner: null });
      }
    });
    return () => unsubscribe();
  }, [winner]);

  const handleClick = async (i) => {
    if (winner || board[i]) return;
    const newBoard = [...board];
    newBoard[i] = isXNext ? '❤️' : '💋';
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let newWinner = null;
    for (let l of lines) { const [a,b,c] = l; if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) newWinner = newBoard[a]; }
    
    if (isFirebaseEnabled && db) {
       await updateDoc(doc(db, "games", "tictactoe"), { board: newBoard, isXNext: !isXNext, winner: newWinner });
    }
  };

  const resetGame = async () => {
    if (isFirebaseEnabled && db) await setDoc(doc(db, "games", "tictactoe"), { board: Array(9).fill(null), isXNext: true, winner: null });
  };

  return (
    <div className="h-[75vh] flex flex-col items-center">
      <div className="bg-teal-50 p-6 rounded-2xl mb-8 w-full flex justify-between items-center"><div><h2 className="text-teal-900 font-bold text-xl">Love Tactics</h2><p className="text-teal-600 text-sm">{winner ? `Winner: ${winner}` : `Next: ${isXNext ? '❤️' : '💋'}`}</p></div><button onClick={resetGame} className="bg-white p-2 rounded-full text-teal-600 shadow-sm"><RotateCcw size={20}/></button></div>
      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">{board.map((cell, i) => (<button key={i} onClick={() => handleClick(i)} className="h-24 bg-white rounded-2xl shadow-sm border border-slate-100 text-4xl flex items-center justify-center hover:bg-slate-50 transition-colors">{cell}</button>))}</div>
    </div>
  );
};

const DrawingNote = ({ currentUser }) => {
  const canvasRef = useRef(null);
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const unsubscribe = onSnapshot(doc(db, "games", "drawing"), (doc) => {
      if (doc.exists()) setLines(doc.data().lines || []);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2; canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    ctx.clearRect(0, 0, rect.width, rect.height);
    lines.forEach(line => {
      ctx.strokeStyle = line.color; ctx.beginPath();
      line.points.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
      ctx.stroke();
    });
  }, [lines]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const point = getPoint(e);
    setLines([...lines, { color: currentUser === 'Krish' ? '#f43f5e' : '#6366f1', points: [point] }]);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const point = getPoint(e);
    const newLines = [...lines];
    newLines[newLines.length - 1].points.push(point);
    setLines(newLines);
  };

  const endDrawing = async () => {
    setIsDrawing(false);
    if (isFirebaseEnabled && db) await setDoc(doc(db, "games", "drawing"), { lines });
  };

  const clearCanvas = async () => {
    if (confirm("Clear the note?")) {
      setLines([]);
      if (isFirebaseEnabled && db) await setDoc(doc(db, "games", "drawing"), { lines: [] });
    }
  };

  return (
    <div className="h-[75vh] flex flex-col">
      <div className="bg-indigo-50 p-4 rounded-2xl mb-4 flex justify-between items-center"><div><h2 className="text-indigo-900 font-bold text-lg">Our Note</h2><p className="text-indigo-600 text-xs">Leave a doodle for them.</p></div><button onClick={clearCanvas} className="bg-white p-2 rounded-full text-indigo-600 shadow-sm"><RotateCcw size={18} /></button></div>
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden touch-none relative"><canvas ref={canvasRef} className="w-full h-full" onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={endDrawing} onMouseLeave={endDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={endDrawing} /><div className="absolute bottom-4 right-4 pointer-events-none bg-slate-100/80 px-3 py-1 rounded-full text-xs text-slate-500">{currentUser === 'Krish' ? 'Red Pen' : 'Blue Pen'}</div></div>
    </div>
  );
};

const HomeScreen = ({ onNavigate, currentUser, setCurrentUser }) => (
  <div className="flex flex-col items-center min-h-[85vh] animate-in fade-in duration-500 relative pb-20">
    <WeatherWidget />
    <div className="bg-white p-1 rounded-full shadow-sm border border-slate-100 flex absolute top-4 left-4 z-10">
      {["Krish", "Shrutisri"].map(user => (
        <button key={user} onClick={() => setCurrentUser(user)} className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${currentUser === user ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>{user === "Krish" ? "K" : "S"}</button>
      ))}
    </div>
    <div className="mt-16 mb-6 text-center">
      <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-2xl mb-4">
        <img src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop" alt="Us" className="w-full h-full object-cover" />
      </div>
      <CountdownWidget />
      <div className="mt-4 flex justify-center"><DistanceWidget currentUser={currentUser} /></div>
    </div>
    <div className="w-full max-w-sm space-y-6 px-4">
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Daily</h3>
        <div className="grid grid-cols-2 gap-3">
          <MenuButtonSmall icon={<Check size={20} />} label="Habits" onClick={() => onNavigate('habits')} color="bg-rose-50 text-rose-600" />
          <MenuButtonSmall icon={<Utensils size={20} />} label="Food" onClick={() => onNavigate('food')} color="bg-orange-50 text-orange-600" />
        </div>
        <MenuButtonSmall icon={<Camera size={20} />} label="Memory Jar" onClick={() => onNavigate('memories')} color="bg-indigo-50 text-indigo-600" fullWidth />
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Fun Zone</h3>
        <div className="grid grid-cols-2 gap-3">
          <MenuButtonSmall icon={<Gamepad2 size={20} />} label="Tic-Tac-Toe" onClick={() => onNavigate('game')} color="bg-teal-50 text-teal-600" />
          <MenuButtonSmall icon={<Zap size={20} />} label="This or That" onClick={() => onNavigate('thisorthat')} color="bg-purple-50 text-purple-600" />
          <MenuButtonSmall icon={<Search size={20} />} label="Word Hunt" onClick={() => onNavigate('wordhunt')} color="bg-pink-50 text-pink-600" />
          <MenuButtonSmall icon={<Smile size={20} />} label="Charades" onClick={() => onNavigate('charades')} color="bg-yellow-50 text-yellow-600" />
          <MenuButtonSmall icon={<Swords size={20} />} label="Kiss War" onClick={() => onNavigate('kisswar')} color="bg-rose-50 text-rose-600" />
          <MenuButtonSmall icon={<Navigation size={20} />} label="Drawing" onClick={() => onNavigate('drawing')} color="bg-blue-50 text-blue-600" />
        </div>
      </div>
    </div>
  </div>
);

export default function App() {
  const [view, setView] = useState('home');
  const [currentUser, setCurrentUser] = useState("Krish"); 

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      {view !== 'home' && (
        <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 p-4 flex items-center z-10">
          <button onClick={() => setView('home')} className="p-2 rounded-full hover:bg-slate-100 transition-colors"><ArrowLeft size={24} className="text-slate-600" /></button>
          <span className="ml-2 font-bold text-lg capitalize truncate max-w-[200px]">{view === 'food' ? 'Dinner' : view === 'game' ? 'Tic-Tac-Toe' : view === 'thisorthat' ? 'This or That' : view === 'drawing' ? 'Our Note' : view === 'wordhunt' ? 'Word Hunt' : view === 'charades' ? 'Emoji Charades' : view === 'kisswar' ? 'Kiss War' : view}</span>
        </div>
      )}
      <div className="p-4 max-w-md mx-auto">
        {view === 'home' && <HomeScreen onNavigate={setView} currentUser={currentUser} setCurrentUser={setCurrentUser} />}
        {view === 'habits' && <HabitTracker currentUser={currentUser} />}
        {view === 'memories' && <MemoryJar />}
        {view === 'food' && <FoodSwiper />}
        {view === 'game' && <LoveTicTacToe currentUser={currentUser} />}
        {view === 'thisorthat' && <ThisOrThat currentUser={currentUser} />}
        {view === 'drawing' && <DrawingNote currentUser={currentUser} />}
        {view === 'wordhunt' && <WordHunt currentUser={currentUser} />}
        {view === 'charades' && <EmojiCharades currentUser={currentUser} />}
        {view === 'kisswar' && <KissWar currentUser={currentUser} />}
      </div>
    </div>
  );
}