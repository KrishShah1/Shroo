import React, { useState, useEffect, useRef } from 'react';
import { 
  Heart, Check, Plus, Trophy, Calendar, Flame, 
  X, Camera, Utensils, ArrowRight, ArrowLeft, MapPin, 
  RefreshCw, User, CloudSun, Gamepad2, RotateCcw,
  Navigation, MessageCircle, PenTool, Zap, HelpCircle,
  Send
} from 'lucide-react';
import confetti from 'canvas-confetti'; 
import { initializeApp } from "firebase/app";
import { 
  getFirestore, collection, addDoc, updateDoc, deleteDoc, setDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp, where, getDoc 
} from "firebase/firestore";

/**
 * --- FIREBASE CONFIGURATION ---
 * Replace this with your actual config from the Firebase Console
 */
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
let db = null;
const isFirebaseEnabled = firebaseConfig.apiKey !== "";

try {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
} catch (error) {
  console.log("Firebase already initialized");
}

// --- HELPER FUNCTIONS ---

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

// --- WIDGETS ---

const WeatherWidget = () => {
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    let lat = 33.9931; // Chino Hills
    let lon = -117.7553;

    const fetchWeather = (latitude, longitude) => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit`)
        .then(res => res.json())
        .then(data => {
          setWeather(Math.round(data.current.temperature_2m));
        })
        .catch(err => console.log("Weather error", err));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => fetchWeather(position.coords.latitude, position.coords.longitude),
        () => fetchWeather(lat, lon)
      );
    } else {
      fetchWeather(lat, lon);
    }
  }, []);

  if (!weather) return null;

  return (
    <div className="absolute top-4 right-4 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-slate-600 flex items-center gap-1 shadow-sm z-10">
      <CloudSun size={14} className="text-orange-400" />
      {weather}°F
    </div>
  );
};

const CountdownWidget = () => {
  // SET ANNIVERSARY DATE HERE
  const targetDate = new Date("2025-12-03"); 
  const today = new Date();
  today.setHours(0,0,0,0);
  targetDate.setHours(0,0,0,0);

  const diffTime = targetDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  const label = diffDays === 0 ? "It's Today!" : diffDays < 0 ? "Days since Anniversary" : "Days until Anniversary";
  const displayDays = Math.abs(diffDays);

  return (
    <div className="bg-white/90 backdrop-blur-sm px-6 py-2 rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center">
      <span className="text-2xl font-bold text-rose-500">{displayDays}</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{label}</span>
    </div>
  );
};

const DistanceWidget = ({ currentUser }) => {
  const [distance, setDistance] = useState(null);
  const [myLoc, setMyLoc] = useState(null);

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;

    if (navigator.geolocation) {
      navigator.geolocation.watchPosition((position) => {
        const loc = { 
          lat: position.coords.latitude, 
          lng: position.coords.longitude,
          timestamp: serverTimestamp()
        };
        setMyLoc(loc);
        setDoc(doc(db, "locations", currentUser), loc);
      }, (err) => console.log(err), { enableHighAccuracy: true });
    }

    const otherUser = currentUser === "Krish" ? "Shrutisri" : "Krish";
    const unsubscribe = onSnapshot(doc(db, "locations", otherUser), (docSnap) => {
      if (docSnap.exists() && myLoc) {
        const partnerLoc = docSnap.data();
        const miles = calculateDistance(myLoc.lat, myLoc.lng, partnerLoc.lat, partnerLoc.lng);
        setDistance(miles.toFixed(1));
      }
    });

    return () => unsubscribe();
  }, [currentUser, myLoc]);

  return (
    <div className="bg-white/90 backdrop-blur-sm px-4 py-3 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-3 w-full max-w-xs">
      <div className="bg-blue-100 p-2 rounded-full text-blue-600">
        <Navigation size={20} className={distance ? "fill-blue-600" : ""} />
      </div>
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Love Radar</h3>
        <p className="text-slate-800 font-bold leading-tight">
          {distance ? `${distance} miles apart` : "Locating..."}
        </p>
      </div>
    </div>
  );
};

// --- NEW FEATURES ---

// 1. THIS OR THAT GAME
const ThisOrThat = ({ currentUser }) => {
  const questions = [
    ["Beach Vacation", "Mountain Cabin"],
    ["Night In", "Night Out"],
    ["Save Money", "Spend Money"],
    ["Horror Movie", "Comedy Movie"],
    ["Sunrise", "Sunset"],
    ["Coffee", "Tea"],
    ["Summer", "Winter"],
    ["Dogs", "Cats"]
  ];

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [votes, setVotes] = useState({}); // { Krish: 0, Shrutisri: 1 }

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const gameRef = doc(db, "games", "thisorthat");
    
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentQIndex(data.currentQIndex || 0);
        setVotes(data.votes || {});
        
        // Check for match & animate
        if (data.votes && data.votes['Krish'] !== undefined && data.votes['Shrutisri'] !== undefined) {
           if (data.votes['Krish'] === data.votes['Shrutisri']) {
             confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
           }
        }
      } else {
        setDoc(gameRef, { currentQIndex: 0, votes: {} });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleVote = async (choiceIndex) => {
    if (!isFirebaseEnabled || !db) return;
    
    // Optimistic UI update
    const newVotes = { ...votes, [currentUser]: choiceIndex };
    setVotes(newVotes);

    await updateDoc(doc(db, "games", "thisorthat"), {
      votes: newVotes
    });
  };

  const nextQuestion = async () => {
    if (!isFirebaseEnabled || !db) return;
    const nextIndex = (currentQIndex + 1) % questions.length;
    await updateDoc(doc(db, "games", "thisorthat"), {
      currentQIndex: nextIndex,
      votes: {} // Reset votes for new round
    });
  };

  const myVote = votes[currentUser];
  const partnerUser = currentUser === "Krish" ? "Shrutisri" : "Krish";
  const partnerVote = votes[partnerUser];
  const bothVoted = myVote !== undefined && partnerVote !== undefined;

  return (
    <div className="h-[75vh] flex flex-col items-center justify-center space-y-8">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-rose-500 mb-2">This or That?</h2>
        <p className="text-slate-400 text-sm">Do you match?</p>
      </div>

      <div className="w-full space-y-4">
        {questions[currentQIndex].map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleVote(idx)}
            className={`w-full p-6 rounded-2xl border-2 text-lg font-bold transition-all ${
              myVote === idx 
                ? 'bg-rose-500 text-white border-rose-500 shadow-lg scale-105' 
                : 'bg-white border-slate-100 text-slate-700 hover:border-rose-200'
            }`}
          >
            {option}
            {bothVoted && partnerVote === idx && (
              <span className="ml-2 text-sm bg-white/20 px-2 py-1 rounded-full">
                {partnerUser} too!
              </span>
            )}
          </button>
        ))}
      </div>

      {bothVoted && (
        <div className="animate-in fade-in slide-in-from-bottom-4 text-center">
          <p className="text-lg font-bold mb-4">
            {myVote === partnerVote ? "🎉 It's a Match!" : "😬 Opposites Attract?"}
          </p>
          <button 
            onClick={nextQuestion}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg active:scale-95 transition-transform"
          >
            Next Question
          </button>
        </div>
      )}
    </div>
  );
};

// 2. SHARED DRAWING NOTE
const DrawingNote = ({ currentUser }) => {
  const canvasRef = useRef(null);
  const [lines, setLines] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);

  // Sync Logic
  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const unsubscribe = onSnapshot(doc(db, "games", "drawing"), (doc) => {
      if (doc.exists()) {
        setLines(doc.data().lines || []);
      }
    });
    return () => unsubscribe();
  }, []);

  // Draw on canvas whenever lines change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Fix resolution for retina displays
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 3;

    ctx.clearRect(0, 0, rect.width, rect.height);

    lines.forEach(line => {
      ctx.strokeStyle = line.color;
      ctx.beginPath();
      line.points.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();
    });
  }, [lines]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e) => {
    setIsDrawing(true);
    const point = getPoint(e);
    // Start a new line locally
    setLines([...lines, { color: currentUser === 'Krish' ? '#f43f5e' : '#6366f1', points: [point] }]);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault(); // Prevent scrolling on mobile
    const point = getPoint(e);
    const newLines = [...lines];
    newLines[newLines.length - 1].points.push(point);
    setLines(newLines);
  };

  const endDrawing = async () => {
    setIsDrawing(false);
    // Save to DB
    if (isFirebaseEnabled && db) {
      await setDoc(doc(db, "games", "drawing"), { lines });
    }
  };

  const clearCanvas = async () => {
    if (confirm("Clear the note?")) {
      setLines([]);
      if (isFirebaseEnabled && db) {
        await setDoc(doc(db, "games", "drawing"), { lines: [] });
      }
    }
  };

  return (
    <div className="h-[75vh] flex flex-col">
      <div className="bg-indigo-50 p-4 rounded-2xl mb-4 flex justify-between items-center">
        <div>
          <h2 className="text-indigo-900 font-bold text-lg">Our Note</h2>
          <p className="text-indigo-600 text-xs">Leave a doodle for them.</p>
        </div>
        <button onClick={clearCanvas} className="bg-white p-2 rounded-full text-indigo-600 shadow-sm">
          <RotateCcw size={18} />
        </button>
      </div>
      
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden touch-none relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />
        <div className="absolute bottom-4 right-4 pointer-events-none bg-slate-100/80 px-3 py-1 rounded-full text-xs text-slate-500">
          {currentUser === 'Krish' ? 'Red Pen' : 'Blue Pen'}
        </div>
      </div>
    </div>
  );
};

// 3. Q&A / WOULD YOU RATHER BOARD
const QABoard = ({ currentUser }) => {
  const [questions, setQuestions] = useState([]);
  const [newQ, setNewQ] = useState("");
  const [mode, setMode] = useState("ask"); // 'ask' or 'list'

  useEffect(() => {
    if (!isFirebaseEnabled || !db) return;
    const q = query(collection(db, "questions"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQuestions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const addQuestion = async (type = 'custom') => {
    if (!newQ.trim()) return;
    await addDoc(collection(db, "questions"), {
      text: newQ,
      author: currentUser,
      type,
      createdAt: serverTimestamp()
    });
    setNewQ("");
  };

  const addWouldYouRather = () => {
    const prompts = [
      "Would you rather always have to say everything on your mind or never be able to speak again?",
      "Would you rather live in a treehouse or a houseboat?",
      "Would you rather be famous or rich?",
      "Would you rather explore space or the deep ocean?",
      "Would you rather have a pause button or a rewind button for your life?",
      "Would you rather have a personal chef or a personal house cleaner?",
      "Would you rather be able to talk to animals or speak every language fluently?",
      "Would you rather always be 10 minutes late or always be 20 minutes early?",
      "Would you rather lose your phone or your wallet?",
      "Would you rather have unlimited free travel or unlimited free food?",
      "Would you rather never get angry or never get jealous?",
      "Would you rather be the funniest person in the room or the smartest?",
      "Would you rather live without music or live without movies?",
      "Would you rather have a photographic memory or be able to forget anything you wanted?",
      "Would you rather accidentally send a spicy text to your boss or your mom?",
      "Would you rather have nosy neighbors or noisy neighbors?",
      "Would you rather be able to fly or be invisible?",
      "Would you rather always have to sing instead of speaking or dance everywhere you went?",
      "Would you rather give up your smartphone or your car for a month?",
      "Would you rather win the lottery or live twice as long?",
      "Would you rather cook dinner every night or do the dishes every night?",
      "Would you rather have a surprise party thrown for you or throw a surprise party for someone else?",
      "Would you rather only be able to whisper or only be able to shout?"
    ];
    const random = prompts[Math.floor(Math.random() * prompts.length)];
    addDoc(collection(db, "questions"), {
      text: random,
      author: "App",
      type: "wyr",
      createdAt: serverTimestamp()
    });
  };

  return (
    <div className="h-[80vh] flex flex-col">
      <div className="bg-yellow-50 p-6 rounded-2xl mb-4">
        <h2 className="text-yellow-900 font-bold text-xl flex items-center gap-2">
          <MessageCircle size={20}/> Ask Us
        </h2>
        <p className="text-yellow-700 text-sm">Deep questions or silly debates.</p>
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={addWouldYouRather} className="flex-1 bg-white border border-slate-200 py-3 rounded-xl text-sm font-bold text-slate-600 flex items-center justify-center gap-2 hover:bg-slate-50">
          <Zap size={16} className="text-yellow-500" />
          Random "Would You Rather"
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <input 
          value={newQ} onChange={e => setNewQ(e.target.value)}
          placeholder="Ask something..."
          className="flex-1 p-3 bg-white border border-slate-200 rounded-xl outline-none focus:border-yellow-400"
        />
        <button onClick={() => addQuestion()} className="bg-yellow-500 text-white p-3 rounded-xl">
          <Send size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pb-20">
        {questions.map(q => (
          <div key={q.id} className={`p-4 rounded-2xl ${q.type === 'wyr' ? 'bg-indigo-50 border border-indigo-100' : 'bg-white border border-slate-100'}`}>
            <div className="flex justify-between items-start mb-1">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${q.type === 'wyr' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                {q.type === 'wyr' ? 'WOULD YOU RATHER' : q.author}
              </span>
            </div>
            <p className="text-slate-800 font-medium text-lg leading-tight">{q.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- COMPONENTS ---

// 1. HOME SCREEN
const HomeScreen = ({ onNavigate, currentUser, setCurrentUser }) => (
  <div className="flex flex-col items-center min-h-[85vh] animate-in fade-in duration-500 relative pb-20">
    
    <WeatherWidget />

    {/* User Switcher */}
    <div className="bg-white p-1 rounded-full shadow-sm border border-slate-100 flex absolute top-4 left-4 z-10">
      {["Krish", "Shrutisri"].map(user => (
        <button
          key={user}
          onClick={() => setCurrentUser(user)}
          className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
            currentUser === user 
              ? 'bg-slate-900 text-white shadow-md' 
              : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {user === "Krish" ? "K" : "S"}
        </button>
      ))}
    </div>

    <div className="mt-16 mb-6 text-center">
      <div className="relative w-32 h-32 mx-auto rounded-full overflow-hidden border-4 border-white shadow-2xl mb-4">
        <img 
          src="https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?q=80&w=1000&auto=format&fit=crop" 
          alt="Us" 
          className="w-full h-full object-cover"
        />
      </div>
      <CountdownWidget />
      <div className="mt-4 flex justify-center">
        <DistanceWidget currentUser={currentUser} />
      </div>
    </div>

    <div className="w-full max-w-sm space-y-6 px-4">
      {/* Daily Essentials */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Daily</h3>
        <div className="grid grid-cols-2 gap-3">
          <MenuButtonSmall 
            icon={<Check size={20} />} 
            label="Habits" 
            onClick={() => onNavigate('habits')} 
            color="bg-rose-50 text-rose-600"
          />
          <MenuButtonSmall 
            icon={<Utensils size={20} />} 
            label="Food" 
            onClick={() => onNavigate('food')} 
            color="bg-orange-50 text-orange-600"
          />
        </div>
        <MenuButtonSmall 
            icon={<Camera size={20} />} 
            label="Memory Jar" 
            onClick={() => onNavigate('memories')} 
            color="bg-indigo-50 text-indigo-600"
            fullWidth
          />
      </div>

      {/* Fun Zone */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">Fun Zone</h3>
        <div className="grid grid-cols-2 gap-3">
          <MenuButtonSmall 
            icon={<Gamepad2 size={20} />} 
            label="Tic-Tac-Toe" 
            onClick={() => onNavigate('game')} 
            color="bg-teal-50 text-teal-600"
          />
          <MenuButtonSmall 
            icon={<Zap size={20} />} 
            label="This or That" 
            onClick={() => onNavigate('thisorthat')} 
            color="bg-purple-50 text-purple-600"
          />
          <MenuButtonSmall 
            icon={<PenTool size={20} />} 
            label="Drawing Note" 
            onClick={() => onNavigate('drawing')} 
            color="bg-blue-50 text-blue-600"
          />
          <MenuButtonSmall 
            icon={<MessageCircle size={20} />} 
            label="Q&A Board" 
            onClick={() => onNavigate('qa')} 
            color="bg-yellow-50 text-yellow-600"
          />
        </div>
      </div>
    </div>
  </div>
);

const MenuButtonSmall = ({ icon, label, onClick, color, fullWidth }) => (
  <button 
    onClick={onClick}
    className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all active:scale-95 shadow-sm border border-slate-100 ${color} ${fullWidth ? 'w-full flex-row' : ''}`}
  >
    <div className="bg-white p-2 rounded-full shadow-sm">{icon}</div>
    <span className="font-bold text-sm">{label}</span>
  </button>
);

// 2. HABIT TRACKER
const HabitTracker = ({ currentUser }) => {
  const [habits, setHabits] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("✨");

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

    if (!isDone) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#FFC0CB', '#FF69B4', '#FF1493', '#C71585'] 
      });
    }

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
            <div key={habit.id} onClick={() => toggleHabit(habit)} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all ${isDone ? 'bg-rose-500 text-white shadow-lg scale-[1.02]' : 'bg-white border border-slate-100'}`}>
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

// 3. MEMORY JAR
const MemoryJar = () => {
  const [memories, setMemories] = useState([]); // Removed sample data for production
  const [page, setPage] = useState(0);
  const [showInput, setShowInput] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const q = query(collection(db, "memories"), orderBy("createdAt", "desc"));
      return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          setMemories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } else {
          setMemories([]);
        }
      });
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setPage(prev => {
        const totalPages = Math.ceil(memories.length / 4);
        if (totalPages === 0) return 0;
        return (prev + 1) % totalPages;
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
          <p className="text-indigo-600 text-sm">{memories.length > 0 ? "Showing 4 at a time." : "No memories yet."}</p>
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
                  <Heart size={24} className="opacity-20" />
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Pagination dots */}
      <div className="flex justify-center gap-1 mb-4">
        {Array.from({ length: Math.ceil(memories.length / 4) }).map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === page ? 'bg-indigo-500' : 'bg-slate-200'}`} />
        ))}
      </div>
    </div>
  );
};

// 4. FOOD SWIPER
const FoodSwiper = () => {
  const [loading, setLoading] = useState(false);
  const [places, setPlaces] = useState([]);
  const [index, setIndex] = useState(0);
  const [error, setError] = useState(null);

  const fallbackCuisines = [
    { id: '1', name: "Mario's Trattoria (Demo)", type: 'Italian', img: 'https://images.unsplash.com/photo-1595295333158-4742f28fbd85?w=600&fit=crop' },
    { id: '2', name: 'Sushi Zen (Demo)', type: 'Japanese', img: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&fit=crop' },
  ];

  const getSmartImage = (name, type) => {
    const text = (name + " " + type).toLowerCase();
    if (text.includes('pizza')) return 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&q=80';
    if (text.includes('burger')) return 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80';
    if (text.includes('sushi') || text.includes('japanese')) return 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&q=80';
    if (text.includes('coffee') || text.includes('starbucks') || text.includes('cafe')) return 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600&q=80';
    if (text.includes('taco') || text.includes('mexican')) return 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80';
    if (text.includes('chinese') || text.includes('asian')) return 'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=600&q=80';
    if (text.includes('indian')) return 'https://images.unsplash.com/photo-1585937421612-70a008356f36?w=600&q=80';
    if (text.includes('ice cream') || text.includes('dessert')) return 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600&q=80';

    const generics = [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80', 
      'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80', 
      'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', 
    ];
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

// 5. LOVE TIC-TAC-TOE GAME (Live Sync)
const LoveTicTacToe = () => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [winner, setWinner] = useState(null);

  useEffect(() => {
    if (isFirebaseEnabled && db) {
      const gameRef = doc(db, "games", "tictactoe");
      const unsubscribe = onSnapshot(gameRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setBoard(data.board);
          setIsXNext(data.isXNext);
          
          if (data.winner && !winner) {
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
    }
  }, [winner]);

  const calculateWinner = (squares) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  };

  const handleClick = async (i) => {
    if (winner || board[i]) return;
    
    const newBoard = [...board];
    newBoard[i] = isXNext ? '❤️' : '💋';
    setBoard(newBoard);
    const nextTurn = !isXNext;
    setIsXNext(nextTurn);
    
    const win = calculateWinner(newBoard);
    if (win) setWinner(win);

    if (isFirebaseEnabled && db) {
       await updateDoc(doc(db, "games", "tictactoe"), {
          board: newBoard,
          isXNext: nextTurn,
          winner: win
       });
    }
  };

  const resetGame = async () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setWinner(null);
    
    if (isFirebaseEnabled && db) {
       await setDoc(doc(db, "games", "tictactoe"), {
          board: Array(9).fill(null),
          isXNext: true,
          winner: null
       });
    }
  };

  return (
    <div className="h-[75vh] flex flex-col items-center">
      <div className="bg-teal-50 p-6 rounded-2xl mb-8 w-full flex justify-between items-center">
         <div>
           <h2 className="text-teal-900 font-bold text-xl">Love Tactics</h2>
           <p className="text-teal-600 text-sm">
             {winner ? `Winner: ${winner}` : `Next Player: ${isXNext ? '❤️' : '💋'}`}
           </p>
         </div>
         <button onClick={resetGame} className="bg-white p-2 rounded-full text-teal-600 shadow-sm"><RotateCcw size={20}/></button>
      </div>

      <div className="grid grid-cols-3 gap-3 w-full max-w-[300px]">
        {board.map((cell, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className="h-24 bg-white rounded-2xl shadow-sm border border-slate-100 text-4xl flex items-center justify-center hover:bg-slate-50 transition-colors"
          >
            {cell}
          </button>
        ))}
      </div>
    </div>
  );
};

// --- MAIN APP ---
export default function App() {
  const [view, setView] = useState('home');
  const [currentUser, setCurrentUser] = useState("Krish"); 

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
            {view === 'food' ? 'Dinner' : view === 'game' ? 'Game Room' : view === 'qa' ? 'Q&A' : view === 'thisorthat' ? 'This or That' : view === 'drawing' ? 'Our Note' : view}
          </span>
        </div>
      )}

      {/* Content Area */}
      <div className="p-4 max-w-md mx-auto">
        {view === 'home' && (
          <HomeScreen 
            onNavigate={setView} 
            currentUser={currentUser} 
            setCurrentUser={setCurrentUser} 
          />
        )}
        {view === 'habits' && <HabitTracker currentUser={currentUser} />}
        {view === 'memories' && <MemoryJar />}
        {view === 'food' && <FoodSwiper />}
        {view === 'game' && <LoveTicTacToe />}
        {view === 'thisorthat' && <ThisOrThat currentUser={currentUser} />}
        {view === 'drawing' && <DrawingNote currentUser={currentUser} />}
        {view === 'qa' && <QABoard currentUser={currentUser} />}
      </div>

    </div>
  );
}