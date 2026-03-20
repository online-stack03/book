import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Calendar, Clock, Trash2, PenLine, X, List, ChevronLeft, ChevronRight, Search, Mic, MicOff, BarChart2, Sparkles, User as UserIcon, LogOut, Palette, Lock, Download, CheckCircle2, Target, Wallet, Plus, PieChart as PieChartIcon, Upload, FileText, FileImage, Folder, FolderPlus, Layout, TrendingUp, Activity, DollarSign, CreditCard, PlusCircle, History, AlertCircle, Info, HelpCircle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import Markdown from 'react-markdown';
import { jsPDF } from 'jspdf';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface User {
  id: number;
  username: string;
  theme: string;
  font_color: string | null;
  accent_color: string | null;
  font_size: number;
  created_at?: string;
  hasPin?: boolean;
}

interface Category {
  id: number;
  name: string;
  user_id: number;
}

interface DiaryEntry {
  id: number;
  content: string;
  image: string | null;
  mood: string | null;
  summary: string | null;
  activities: string | null;
  tags: string | null;
  type?: string;
  category?: string | null;
  created_at: string;
}

interface Expense {
  id: number;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  created_at: string;
}

export default function App() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [content, setContent] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'charts' | 'profile' | 'finance'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('餐饮');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [expenseToDelete, setExpenseToDelete] = useState<number | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [diaryDateFilter, setDiaryDateFilter] = useState('');
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  const [entryType, setEntryType] = useState<'normal' | 'review' | 'success'>('normal');
  const [entryToDelete, setEntryToDelete] = useState<number | null>(null);
  const [newPin, setNewPin] = useState('');

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [fontColor, setFontColor] = useState<string>('');
  const [accentColor, setAccentColor] = useState<string>('');
  const [fontSize, setFontSize] = useState<number>(16);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  useEffect(() => {
    const savedUser = localStorage.getItem('diary_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setFontColor(user.font_color || '');
      setAccentColor(user.accent_color || '');
      setFontSize(user.font_size || 16);
      fetchEntries(user.id);
      fetchExpenses(user.id);
      fetchCategories(user.id);
    }
  }, []);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setContent(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
        }
      };
      
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) {
        console.error("Could not start recording", e);
      }
    }
  };

  const fetchEntries = async (userId: number) => {
    try {
      const res = await fetch(`/api/entries?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data);
      }
    } catch (error) {
      console.error('Failed to fetch entries:', error);
    }
  };

  const fetchExpenses = async (userId: number) => {
    try {
      const res = await fetch(`/api/expenses?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data);
      }
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    }
  };

  const fetchCategories = async (userId: number) => {
    try {
      const res = await fetch(`/api/users/${userId}/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    }
  };

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim() || !currentUser) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      if (res.ok) {
        const newCat = await res.json();
        setCategories([...categories, newCat]);
        setNewCategoryName('');
      }
    } catch (error) {
      console.error('Failed to create category:', error);
    }
  };

  const handleDeleteCategory = (id: number) => {
    setCategoryToDelete(id);
  };

  const executeDeleteCategory = async () => {
    if (!categoryToDelete) return;
    try {
      const res = await fetch(`/api/categories/${categoryToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        setCategories(categories.filter(c => c.id !== categoryToDelete));
        setCategoryToDelete(null);
      }
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const handleUpdateFont = async (color: string, size: number, accent?: string) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/font`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ font_color: color, font_size: size, accent_color: accent || accentColor })
      });
      if (res.ok) {
        setFontColor(color);
        setFontSize(size);
        if (accent !== undefined) setAccentColor(accent);
        const updatedUser = { ...currentUser, font_color: color, font_size: size, accent_color: accent || accentColor };
        setCurrentUser(updatedUser);
        localStorage.setItem('diary_user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Failed to update font settings:', error);
    }
  };

  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || !expenseCategory || !expenseDate) return;

    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(expenseAmount),
          category: expenseCategory,
          description: expenseDesc,
          date: expenseDate,
          userId: currentUser?.id
        }),
      });

      if (res.ok) {
        const newExpense = await res.json();
        setExpenses([newExpense, ...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        setExpenseAmount('');
        setExpenseDesc('');
      }
    } catch (error) {
      console.error('Failed to create expense:', error);
    }
  };

  const executeDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      const res = await fetch(`/api/expenses/${expenseToDelete}?userId=${currentUser?.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setExpenses(expenses.filter((exp) => exp.id !== expenseToDelete));
      }
    } catch (error) {
      console.error('Failed to delete expense:', error);
    } finally {
      setExpenseToDelete(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const analyzeEntry = async (text: string) => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `分析以下日记内容，提取情绪指数（1-5，1是很差，5是极好），一句话摘要，提到的具体活动列表，以及1-3个系统分类标签（如：工作、生活、学习、健康、情感、娱乐等）。
        
        日记内容: ${text}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mood: { type: Type.NUMBER, description: "情绪指数 1-5" },
              summary: { type: Type.STRING, description: "一句话摘要" },
              activities: { type: Type.ARRAY, items: { type: Type.STRING }, description: "活动列表" },
              tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: "系统分类标签" }
            },
            required: ["mood", "summary", "activities", "tags"]
          }
        }
      });
      return JSON.parse(response.text?.trim() || "{}");
    } catch (error) {
      console.error("AI Analysis failed:", error);
      return { mood: 3, summary: "无法生成摘要", activities: [], tags: [] };
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !image) return;

    setIsSubmitting(true);
    try {
      let analysis = { mood: null, summary: null, activities: null, tags: null };
      if (content.trim()) {
        analysis = await analyzeEntry(content);
      }

      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          content, 
          image,
          mood: analysis.mood,
          summary: analysis.summary,
          activities: analysis.activities,
          tags: analysis.tags,
          type: entryType,
          category: selectedCategory,
          userId: currentUser?.id
        }),
      });

      if (res.ok) {
        const newEntry = await res.json();
        setEntries([newEntry, ...entries]);
        setContent('');
        setImage(null);
        setEntryType('normal');
        setSelectedCategory('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    } catch (error) {
      console.error('Failed to save entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = (id: number) => {
    setEntryToDelete(id);
  };

  const executeDelete = async () => {
    if (!entryToDelete) return;
    try {
      const res = await fetch(`/api/entries/${entryToDelete}?userId=${currentUser?.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setEntries(entries.filter((entry) => entry.id !== entryToDelete));
      }
    } catch (error) {
      console.error('Failed to delete entry:', error);
    } finally {
      setEntryToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    const safeDateString = dateString.replace(' ', 'T');
    const date = new Date(safeDateString.includes('Z') ? safeDateString : safeDateString + 'Z');
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    }).format(date);
  };

  const formatTime = (dateString: string) => {
    const safeDateString = dateString.replace(' ', 'T');
    const date = new Date(safeDateString.includes('Z') ? safeDateString : safeDateString + 'Z');
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const getMoodEmoji = (moodStr: string | null | undefined) => {
    if (!moodStr) return '😐';
    const mood = parseFloat(moodStr);
    if (mood >= 4.5) return '😄';
    if (mood >= 3.5) return '🙂';
    if (mood >= 2.5) return '😐';
    if (mood >= 1.5) return '😔';
    return '😭';
  };

  const getMoodColor = (moodStr: string | null | undefined) => {
    if (!moodStr) return 'bg-[var(--border)]';
    const mood = parseFloat(moodStr);
    if (mood >= 4.5) return 'bg-emerald-400';
    if (mood >= 3.5) return 'bg-green-300';
    if (mood >= 2.5) return 'bg-yellow-300';
    if (mood >= 1.5) return 'bg-orange-400';
    return 'bg-red-400';
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    
    const days = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[var(--bg-secondary)] rounded-3xl shadow-sm p-6 mb-8 border border-[var(--border)]"
      >
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-2 hover:bg-[var(--bg-primary)] rounded-full text-[var(--accent)] transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-[var(--accent)] font-sans">
            {year}年 {month + 1}月
          </h2>
          <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-2 hover:bg-[var(--bg-primary)] rounded-full text-[var(--accent)] transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm font-medium text-[var(--text-secondary)] py-2 font-sans">
              {day}
            </div>
          ))}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {days.map((date, index) => {
            if (!date) return <div key={`empty-${index}`} className="p-2" />;
            
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            const isToday = new Date().toDateString() === date.toDateString();
            
            const dayEntries = entries.filter(entry => {
              const safeDateStr = entry.created_at.replace(' ', 'T');
              const entryDate = new Date(safeDateStr.includes('Z') ? safeDateStr : safeDateStr + 'Z');
              return entryDate.getFullYear() === date.getFullYear() &&
                     entryDate.getMonth() === date.getMonth() &&
                     entryDate.getDate() === date.getDate();
            });
            
            const hasEntries = dayEntries.length > 0;
            let avgMood = 0;
            if (hasEntries) {
              const validMoods = dayEntries.map(e => parseFloat(e.mood || '0')).filter(m => m > 0);
              if (validMoods.length > 0) {
                avgMood = validMoods.reduce((a, b) => a + b, 0) / validMoods.length;
              }
            }
            
            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(isSelected ? null : date)}
                className={`
                  relative p-2 h-12 rounded-xl flex items-center justify-center font-sans text-sm transition-all
                  ${isSelected ? 'bg-[var(--accent)] text-white shadow-md' : 'hover:bg-[var(--bg-primary)] text-[var(--text-primary)]'}
                  ${isToday && !isSelected ? 'border border-[#5A5A40] font-bold' : ''}
                `}
              >
                {date.getDate()}
                {hasEntries && (
                  <span className={`absolute bottom-1.5 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-[var(--bg-secondary)]' : (avgMood > 0 ? getMoodColor(avgMood.toString()).replace('bg-', 'bg-') : 'bg-[var(--accent)]')}`} />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    );
  };

  const renderCharts = () => {
    // Prepare data for mood trend
    const trendData = [...entries]
      .filter(e => e.mood)
      .sort((a, b) => {
        const safeA = a.created_at.replace(' ', 'T');
        const safeB = b.created_at.replace(' ', 'T');
        return new Date(safeA.includes('Z') ? safeA : safeA + 'Z').getTime() - new Date(safeB.includes('Z') ? safeB : safeB + 'Z').getTime();
      })
      .map(e => {
        const safeDateStr = e.created_at.replace(' ', 'T');
        return {
          date: new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(safeDateStr.includes('Z') ? safeDateStr : safeDateStr + 'Z')),
          mood: parseFloat(e.mood || '0')
        };
      });

    // Prepare data for activity impact
    const activityMap: Record<string, { count: number, totalMood: number }> = {};
    entries.forEach(entry => {
      if (entry.activities && entry.mood) {
        try {
          const acts = JSON.parse(entry.activities);
          const mood = parseFloat(entry.mood);
          acts.forEach((act: string) => {
            if (!activityMap[act]) activityMap[act] = { count: 0, totalMood: 0 };
            activityMap[act].count += 1;
            activityMap[act].totalMood += mood;
          });
        } catch (e) {}
      }
    });

    const activityData = Object.keys(activityMap)
      .map(act => ({
        name: act,
        avgMood: activityMap[act].totalMood / activityMap[act].count,
        count: activityMap[act].count
      }))
      .sort((a, b) => b.avgMood - a.avgMood)
      .slice(0, 10); // Top 10 activities

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-sm p-6 border border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--accent)] font-sans mb-6">情绪趋势</h2>
          {trendData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [value.toFixed(1), '情绪指数']}
                  />
                  <Line type="monotone" dataKey="mood" stroke="var(--accent)" strokeWidth={3} dot={{ fill: 'var(--accent)', strokeWidth: 2, r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-[var(--text-secondary)] italic py-8">需要更多带情绪记录的日记来生成趋势图</p>
          )}
        </div>

        <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-sm p-6 border border-[var(--border)]">
          <h2 className="text-xl font-bold text-[var(--accent)] font-sans mb-6">活动对情绪的影响</h2>
          {activityData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-light)" />
                  <XAxis type="number" domain={[0, 5]} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: 'var(--text-primary)', fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [value.toFixed(1), '平均情绪']}
                  />
                  <Bar dataKey="avgMood" fill="var(--text-secondary)" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-center text-[var(--text-secondary)] italic py-8">需要更多带活动记录的日记来生成分析图</p>
          )}
        </div>
      </motion.div>
    );
  };

  const renderProfile = () => {
    if (!currentUser) return null;

    const totalEntries = entries.length;
    const validMoods = entries.map(e => parseFloat(e.mood || '0')).filter(m => m > 0);
    const avgMood = validMoods.length > 0 ? (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1) : '暂无';
    
    // Calculate top tags
    const tagMap: Record<string, number> = {};
    entries.forEach(entry => {
      if (entry.tags) {
        try {
          const tags = JSON.parse(entry.tags);
          tags.forEach((tag: string) => {
            tagMap[tag] = (tagMap[tag] || 0) + 1;
          });
        } catch (e) {}
      }
    });
    const topTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(t => t[0]);

    const joinedDate = currentUser.created_at ? formatDate(currentUser.created_at) : '刚刚';

    const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentUser) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          if (data.entries || data.expenses) {
            if (confirm('导入数据将合并到当前账户中，确定继续吗？')) {
              const res = await fetch(`/api/users/${currentUser.id}/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              
              if (res.ok) {
                alert('数据导入成功！');
                fetchEntries(currentUser.id);
                fetchExpenses(currentUser.id);
              } else {
                alert('导入失败，请检查文件格式');
              }
            }
          } else {
            alert('无效的数据文件格式');
          }
        } catch (err) {
          console.error('Import failed:', err);
          alert('解析文件失败，请确保是有效的JSON格式');
        }
      };
      reader.readAsText(file);
    };

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-sm p-8 border border-[var(--border)] text-center">
          <div className="w-24 h-24 bg-[var(--accent)] rounded-full flex items-center justify-center text-white font-sans font-bold text-4xl mx-auto mb-4">
            {currentUser.username.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] font-sans mb-1">{currentUser.username}</h2>
          <p className="text-[var(--text-secondary)] text-sm mb-8">加入于 {joinedDate}</p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-[var(--bg-tertiary)] p-4 rounded-2xl border border-[var(--border-light)]">
              <div className="text-3xl font-bold text-[var(--accent)] mb-1 font-sans">{totalEntries}</div>
              <div className="text-sm text-[var(--text-secondary)]">日记总数</div>
            </div>
            <div className="bg-[var(--bg-tertiary)] p-4 rounded-2xl border border-[var(--border-light)]">
              <div className="text-3xl font-bold text-[var(--accent)] mb-1 font-sans">{avgMood}</div>
              <div className="text-sm text-[var(--text-secondary)]">平均心情</div>
            </div>
          </div>

          {topTags.length > 0 && (
            <div className="text-left mb-8">
              <h3 className="text-sm font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">最常记录的标签</h3>
              <div className="flex flex-wrap gap-2">
                {topTags.map(tag => (
                  <button 
                    key={tag}
                    onClick={() => {
                      setSearchQuery(tag);
                      setViewMode('list');
                    }}
                    className="px-4 py-2 bg-[var(--accent)]/10 text-[var(--accent)] rounded-full text-sm font-medium hover:bg-[var(--accent)]/20 transition-colors"
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-[var(--border-light)] pt-8 text-left">
            <h3 className="text-lg font-bold text-[var(--text-primary)] font-sans mb-4 flex items-center gap-2">
              <Palette className="w-5 h-5 text-[var(--accent)]" /> 
              字体设置
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-muted)] uppercase font-bold">字体颜色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={fontColor || '#000000'}
                    onChange={(e) => handleUpdateFont(e.target.value, fontSize)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <button 
                    onClick={() => handleUpdateFont('', fontSize)}
                    className="px-3 py-1 text-xs bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]"
                  >
                    重置
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-muted)] uppercase font-bold">主题色</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={accentColor || '#5A5A40'}
                    onChange={(e) => handleUpdateFont(fontColor, fontSize, e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                  />
                  <button 
                    onClick={() => handleUpdateFont(fontColor, fontSize, '')}
                    className="px-3 py-1 text-xs bg-[var(--bg-tertiary)] rounded-lg border border-[var(--border)]"
                  >
                    默认
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-[var(--text-muted)] uppercase font-bold">字体大小 ({fontSize}px)</label>
                <input
                  type="range"
                  min="12"
                  max="32"
                  value={fontSize}
                  onChange={(e) => handleUpdateFont(fontColor, parseInt(e.target.value))}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>

            <h3 className="text-lg font-bold text-[var(--text-primary)] font-sans mb-4 flex items-center gap-2">
              <List className="w-5 h-5 text-[var(--accent)]" /> 
              日记分类管理
            </h3>
            <div className="space-y-4 mb-8">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="新分类名称"
                  className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] font-sans"
                />
                <button
                  onClick={handleCreateCategory}
                  className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent-hover)] transition-colors font-sans"
                >
                  添加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center gap-1 px-3 py-1.5 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-full group">
                    <span className="text-sm font-sans">{cat.name}</span>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-0.5 text-[var(--text-muted)] hover:text-red-500 rounded-full transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {categories.length === 0 && <p className="text-sm text-[var(--text-muted)] italic">暂无自定义分类</p>}
              </div>
            </div>

            <h3 className="text-lg font-bold text-[var(--text-primary)] font-sans mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-[var(--accent)]" /> 
              应用锁设置
            </h3>
            <form onSubmit={handleSetPin} className="flex gap-3 mb-4">
              <input
                type="password"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder={currentUser.hasPin ? "输入新密码修改/留空移除" : "设置4-6位数字密码"}
                className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] font-sans"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent-hover)] transition-colors font-sans whitespace-nowrap"
              >
                保存设置
              </button>
            </form>
            <p className="text-xs text-[var(--text-muted)] mb-8">
              设置应用锁后，每次进入日记本都需要输入密码。如果想移除密码，请留空并点击保存。
            </p>

            <h3 className="text-lg font-bold text-[var(--text-primary)] font-sans mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-[var(--accent)]" /> 
              数据管理
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
              <button
                onClick={exportData}
                className="py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl font-medium hover:bg-[var(--bg-primary)] transition-colors font-sans flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> 备份 (JSON)
              </button>
              <label className="py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl font-medium hover:bg-[var(--bg-primary)] transition-colors font-sans flex items-center justify-center gap-2 cursor-pointer">
                <Upload className="w-4 h-4" /> 导入数据
                <input type="file" accept=".json" onChange={handleImport} className="hidden" />
              </label>
              <button
                onClick={exportToTxt}
                className="py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl font-medium hover:bg-[var(--bg-primary)] transition-colors font-sans flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" /> 导出文本 (TXT)
              </button>
              <button
                onClick={exportToPdf}
                className="py-3 bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl font-medium hover:bg-[var(--bg-primary)] transition-colors font-sans flex items-center justify-center gap-2"
              >
                <FileImage className="w-4 h-4" /> 导出图片 (PDF)
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const renderFinance = () => {
    const today = new Date().toISOString().split('T')[0];
    const thisMonth = today.substring(0, 7);
    const thisYear = today.substring(0, 4);

    const dailyTotal = expenses.filter(e => e.date === today).reduce((sum, e) => sum + e.amount, 0);
    const monthlyTotal = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((sum, e) => sum + e.amount, 0);
    const yearlyTotal = expenses.filter(e => e.date.startsWith(thisYear)).reduce((sum, e) => sum + e.amount, 0);

    const categoryTotals = expenses.filter(e => e.date.startsWith(thisMonth)).reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));
    const COLORS = ['#F27D26', '#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#64748b'];

    // --- Expense Curve Logic ---
    const daysInMonth = new Date(parseInt(thisYear), parseInt(thisMonth.substring(5,7)), 0).getDate();
    const curveData = Array.from({length: daysInMonth}, (_, i) => {
      const day = String(i + 1).padStart(2, '0');
      const dateStr = `${thisMonth}-${day}`;
      const amount = expenses.filter(e => e.date === dateStr).reduce((sum, e) => sum + e.amount, 0);
      return { date: day, amount };
    });
    // ------------------------------

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border)] text-center">
            <p className="text-sm text-[var(--text-muted)] mb-1">今日支出</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">¥{dailyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border)] text-center">
            <p className="text-sm text-[var(--text-muted)] mb-1">本月支出</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">¥{monthlyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-[var(--bg-secondary)] p-4 rounded-2xl border border-[var(--border)] text-center">
            <p className="text-sm text-[var(--text-muted)] mb-1">本年支出</p>
            <p className="text-2xl font-bold text-[var(--text-primary)]">¥{yearlyTotal.toFixed(2)}</p>
          </div>
        </div>

        {/* Expense Curve Section */}
        <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border)]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-[var(--accent)]" /> 本月支出曲线
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-light)" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="var(--text-muted)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="var(--text-muted)" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `¥${value}`}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                  labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
                  formatter={(value: number) => [`¥${value.toFixed(2)}`, '支出']}
                  labelFormatter={(label) => `${thisMonth}-${label}`}
                />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="var(--accent)" 
                  strokeWidth={3}
                  dot={{ fill: 'var(--accent)', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border)]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-[var(--accent)]" /> 记一笔
          </h3>
          <form onSubmit={handleExpenseSubmit} className="space-y-4">
            <div className="flex gap-4">
              <input
                type="number"
                step="0.01"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                placeholder="金额"
                className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                required
              />
              <select
                value={expenseCategory}
                onChange={e => setExpenseCategory(e.target.value)}
                className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
              >
                {['餐饮', '交通', '购物', '娱乐', '居住', '医疗', '教育', '其他'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <input
                type="date"
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
                required
              />
            </div>
            <div className="flex gap-4">
              <input
                type="text"
                value={expenseDesc}
                onChange={e => setExpenseDesc(e.target.value)}
                placeholder="备注说明（可选）"
                className="flex-1 px-4 py-2 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
              />
              <button
                type="submit"
                className="px-6 py-2 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent-hover)] transition-colors whitespace-nowrap"
              >
                保存
              </button>
            </div>
          </form>
        </div>

        {pieData.length > 0 && (
          <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border)]">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-[var(--accent)]" /> 本月支出分类
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `¥${value.toFixed(2)}`}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-4 mt-4">
              {pieData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  {entry.name}: ¥{entry.value.toFixed(2)}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-[var(--bg-secondary)] p-6 rounded-3xl border border-[var(--border)]">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <List className="w-5 h-5 text-[var(--accent)]" /> 支出明细
          </h3>
          <div className="space-y-3">
            {expenses.slice(0, 20).map(expense => (
              <div key={expense.id} className="flex items-center justify-between p-3 hover:bg-[var(--bg-primary)] rounded-xl transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-[var(--accent)]/10 text-[var(--accent)] flex items-center justify-center font-medium text-sm">
                    {expense.category.substring(0, 1)}
                  </div>
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">{expense.category} {expense.description && <span className="text-[var(--text-muted)] font-normal text-sm ml-2">- {expense.description}</span>}</p>
                    <p className="text-xs text-[var(--text-muted)]">{expense.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-[var(--text-primary)]">¥{expense.amount.toFixed(2)}</span>
                  <button
                    onClick={() => setExpenseToDelete(expense.id)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            {expenses.length === 0 && (
              <p className="text-center text-[var(--text-muted)] py-4">暂无支出记录</p>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const displayedEntries = entries.filter(entry => {
    const searchLower = searchQuery.toLowerCase();
    const matchesContent = entry.content.toLowerCase().includes(searchLower);
    const matchesTags = entry.tags ? entry.tags.toLowerCase().includes(searchLower) : false;
    const matchesActivities = entry.activities ? entry.activities.toLowerCase().includes(searchLower) : false;
    
    if (!matchesContent && !matchesTags && !matchesActivities) return false;

    if (activeCategory !== 'all' && entry.category !== activeCategory) return false;

    const safeDateStr = entry.created_at.replace(' ', 'T');
    const entryDate = new Date(safeDateStr.includes('Z') ? safeDateStr : safeDateStr + 'Z');

    if (viewMode === 'list') {
      if (diaryDateFilter) {
        const entryDateLocalStr = new Date(entryDate.getTime() - (entryDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        if (entryDateLocalStr !== diaryDateFilter) return false;
      }
      return true;
    }
    
    if (selectedDate) {
      return entryDate.getFullYear() === selectedDate.getFullYear() &&
             entryDate.getMonth() === selectedDate.getMonth() &&
             entryDate.getDate() === selectedDate.getDate();
    } else {
      return entryDate.getFullYear() === currentMonth.getFullYear() &&
             entryDate.getMonth() === currentMonth.getMonth();
    }
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim()) return;
    setLoginError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginName.trim(), pin: loginPin })
      });
      
      if (res.status === 401) {
        const data = await res.json();
        if (data.requiresPin) {
          setRequiresPin(true);
        } else {
          setLoginError(data.error || '密码错误');
        }
        return;
      }
      
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setFontColor(user.font_color || '');
        setFontSize(user.font_size || 16);
        localStorage.setItem('diary_user', JSON.stringify(user));
        fetchEntries(user.id);
        fetchCategories(user.id);
        setLoginPin('');
        setRequiresPin(false);
      }
    } catch (error) {
      console.error('Login failed:', error);
      setLoginError('登录失败，请重试');
    }
  };

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    try {
      const res = await fetch(`/api/users/${currentUser.id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: newPin })
      });
      if (res.ok) {
        const updatedUser = { ...currentUser, hasPin: !!newPin };
        setCurrentUser(updatedUser);
        localStorage.setItem('diary_user', JSON.stringify(updatedUser));
        setNewPin('');
        alert(newPin ? '应用锁已设置' : '应用锁已移除');
      }
    } catch (error) {
      console.error('Failed to set PIN:', error);
    }
  };

  const exportData = () => {
    const exportObject = {
      entries: entries,
      expenses: expenses
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportObject, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `data_export_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const exportToTxt = () => {
    let text = `我的个人日记本 - ${currentUser?.username}\n`;
    text += `导出日期: ${new Date().toLocaleString()}\n`;
    text += `==========================================\n\n`;
    
    text += `【日记条目】\n\n`;
    entries.forEach(entry => {
      text += `日期: ${formatDate(entry.created_at)} ${formatTime(entry.created_at)}\n`;
      if (entry.mood) text += `心情: ${getMoodEmoji(entry.mood)} (${entry.mood})\n`;
      if (entry.summary) text += `摘要: ${entry.summary}\n`;
      text += `内容:\n${entry.content}\n`;
      if (entry.tags) text += `标签: ${JSON.parse(entry.tags).join(', ')}\n`;
      text += `------------------------------------------\n\n`;
    });

    text += `\n【支出明细】\n\n`;
    expenses.forEach(exp => {
      text += `${exp.date} | ${exp.category} | ¥${exp.amount.toFixed(2)} | ${exp.description || ''}\n`;
    });

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `diary_export_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToPdf = () => {
    const doc = new jsPDF();
    let y = 20;
    
    doc.setFontSize(20);
    doc.text(`Diary Images - ${currentUser?.username}`, 20, y);
    y += 20;

    const entriesWithImages = entries.filter(e => e.image);
    
    if (entriesWithImages.length === 0) {
      doc.setFontSize(12);
      doc.text("No images found in diary entries.", 20, y);
      doc.save(`diary_images_${currentUser?.username}.pdf`);
      return;
    }

    entriesWithImages.forEach((entry, index) => {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      
      doc.setFontSize(10);
      doc.text(`${formatDate(entry.created_at)} ${formatTime(entry.created_at)}`, 20, y);
      y += 10;

      if (entry.image) {
        try {
          // Add image to PDF. We assume it's a data URL.
          doc.addImage(entry.image, 'JPEG', 20, y, 160, 100);
          y += 110;
        } catch (e) {
          doc.text("[Image could not be processed]", 20, y);
          y += 10;
        }
      }
    });

    doc.save(`diary_images_${currentUser?.username}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const changeTheme = async (newTheme: string) => {
    if (!currentUser) return;
    const updatedUser = { ...currentUser, theme: newTheme };
    setCurrentUser(updatedUser);
    localStorage.setItem('diary_user', JSON.stringify(updatedUser));
    
    try {
      await fetch(`/api/users/${currentUser.id}/theme`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: newTheme })
      });
    } catch (error) {
      console.error('Failed to save theme:', error);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEntries([]);
    localStorage.removeItem('diary_user');
    setShowSettings(false);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center font-serif px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[var(--bg-secondary)] p-8 rounded-3xl shadow-sm border border-[var(--border)] w-full max-w-md text-center"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-[var(--accent)] rounded-full flex items-center justify-center text-white">
              <PenLine className="w-8 h-8" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[var(--accent)] mb-2">我的日记</h1>
          <p className="text-[var(--text-secondary)] mb-8">
            {requiresPin ? `欢迎回来，${loginName}` : '请输入您的名字以继续'}
          </p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            {!requiresPin ? (
              <input
                type="text"
                value={loginName}
                onChange={(e) => setLoginName(e.target.value)}
                placeholder="您的名字"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-sans text-center text-lg bg-transparent text-[var(--text-primary)]"
                required
              />
            ) : (
              <input
                type="password"
                value={loginPin}
                onChange={(e) => setLoginPin(e.target.value)}
                placeholder="请输入应用锁密码"
                className="w-full px-4 py-3 rounded-xl border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-sans text-center text-lg bg-transparent text-[var(--text-primary)]"
                required
                autoFocus
              />
            )}
            {loginError && <p className="text-red-500 text-sm font-sans">{loginError}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-[var(--accent)] text-white rounded-xl font-medium hover:bg-[var(--accent-hover)] transition-colors font-sans"
            >
              进入日记
            </button>
            {requiresPin && (
              <button
                type="button"
                onClick={() => {
                  setRequiresPin(false);
                  setLoginPin('');
                  setLoginError('');
                }}
                className="w-full py-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-sm font-sans transition-colors"
              >
                返回修改名字
              </button>
            )}
          </form>
        </motion.div>
      </div>
    );
  }

  const themeClass = currentUser.theme === 'dark' ? 'theme-dark' : 
                     currentUser.theme === 'light' ? 'theme-light' : 
                     currentUser.theme === 'sepia' ? 'theme-sepia' : 
                     currentUser.theme === 'blue' ? 'theme-blue' : 
                     currentUser.theme === 'green' ? 'theme-green' : 
                     currentUser.theme === 'sakura' ? 'theme-sakura' : '';

  const customStyles = accentColor ? {
    '--accent': accentColor,
    '--accent-hover': accentColor + 'ee', // Subtle adjustment
  } as React.CSSProperties : {};

  return (
    <div className={`min-h-screen bg-[var(--bg-primary)] font-serif text-[var(--text-primary)] ${themeClass}`} style={customStyles}>
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="mb-8 text-center relative">
          <div className="absolute right-0 top-0">
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className="flex items-center gap-2 p-2 rounded-full hover:bg-[var(--bg-tertiary)] transition-colors text-[var(--text-secondary)]"
              >
                <div className="w-8 h-8 bg-[var(--accent)] rounded-full flex items-center justify-center text-white font-sans font-bold text-sm">
                  {currentUser.username.charAt(0).toUpperCase()}
                </div>
              </button>
              
              <AnimatePresence>
                {showSettings && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 mt-2 w-48 bg-[var(--bg-secondary)] rounded-2xl shadow-lg border border-[var(--border)] overflow-hidden z-50 text-left"
                  >
                    <div className="p-4 border-b border-[var(--border-light)]">
                      <p className="font-sans font-medium text-[var(--text-primary)] truncate">{currentUser.username}</p>
                    </div>
                    <div className="p-2">
                      <button onClick={() => { setViewMode('profile'); setShowSettings(false); }} className="w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]">
                        <UserIcon className="w-4 h-4" /> 个人主页
                      </button>
                    </div>
                    <div className="p-2 border-t border-[var(--border-light)]">
                      <div className="px-3 py-2 text-xs font-sans text-[var(--text-muted)] uppercase tracking-wider">主题</div>
                      <button onClick={() => changeTheme('warm')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'warm' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 暖色 (默认)
                      </button>
                      <button onClick={() => changeTheme('light')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'light' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 浅色
                      </button>
                      <button onClick={() => changeTheme('dark')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'dark' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 深色
                      </button>
                      <button onClick={() => changeTheme('sepia')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'sepia' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 复古
                      </button>
                      <button onClick={() => changeTheme('blue')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'blue' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 蔚蓝
                      </button>
                      <button onClick={() => changeTheme('green')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'green' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 翠绿
                      </button>
                      <button onClick={() => changeTheme('sakura')} className={`w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 ${currentUser.theme === 'sakura' ? 'bg-[var(--bg-tertiary)] text-[var(--accent)]' : 'text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]'}`}>
                        <Palette className="w-4 h-4" /> 樱花
                      </button>
                    </div>
                    <div className="p-2 border-t border-[var(--border-light)]">
                      <button onClick={handleLogout} className="w-full text-left px-3 py-2 text-sm font-sans rounded-xl flex items-center gap-2 text-red-500 hover:bg-red-50/10">
                        <LogOut className="w-4 h-4" /> 退出登录
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-[var(--accent)] mb-2 flex items-center justify-center gap-3">
            <PenLine className="w-8 h-8" />
            我的日记
          </h1>
          <p className="text-[var(--text-secondary)] italic mb-6">记录生活中的每一个瞬间</p>
          
          <div className="flex justify-center">
            <div className="flex items-center bg-[var(--bg-secondary)] rounded-full p-1 shadow-sm border border-[var(--border)] overflow-x-auto scrollbar-hide">
              <button
                onClick={() => { setViewMode('list'); setSelectedDate(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${viewMode === 'list' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
              >
                <List className="w-4 h-4" />
                <span className="text-sm font-sans font-medium hidden sm:inline">列表</span>
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${viewMode === 'calendar' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
              >
                <Calendar className="w-4 h-4" />
                <span className="text-sm font-sans font-medium hidden sm:inline">日历</span>
              </button>
              <button
                onClick={() => setViewMode('charts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${viewMode === 'charts' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
              >
                <BarChart2 className="w-4 h-4" />
                <span className="text-sm font-sans font-medium hidden sm:inline">分析</span>
              </button>
              <button
                onClick={() => setViewMode('finance')}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${viewMode === 'finance' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-primary)]'}`}
              >
                <Wallet className="w-4 h-4" />
                <span className="text-sm font-sans font-medium hidden sm:inline">记账</span>
              </button>
            </div>
          </div>
        </header>

        {viewMode === 'calendar' && renderCalendar()}
        {viewMode === 'charts' && renderCharts()}
        {viewMode === 'profile' && renderProfile()}
        {viewMode === 'finance' && renderFinance()}

        {/* Compose Entry */}
        {viewMode === 'list' && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[var(--bg-secondary)] rounded-3xl shadow-sm p-6 mb-12 border border-[var(--border)]"
        >
          <form onSubmit={handleSubmit}>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
              <button
                type="button"
                onClick={() => setEntryType('normal')}
                className={`px-4 py-2 rounded-full text-sm font-sans font-medium whitespace-nowrap transition-colors ${entryType === 'normal' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                普通日记
              </button>
              <button
                type="button"
                onClick={() => setEntryType('review')}
                className={`px-4 py-2 rounded-full text-sm font-sans font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${entryType === 'review' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                <Target className="w-4 h-4" /> 每日复盘
              </button>
              <button
                type="button"
                onClick={() => setEntryType('success')}
                className={`px-4 py-2 rounded-full text-sm font-sans font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${entryType === 'success' ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'}`}
              >
                <CheckCircle2 className="w-4 h-4" /> 成功日记
              </button>
              
              <div className="h-8 w-px bg-[var(--border-light)] mx-1 shrink-0" />
              
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border)] rounded-full text-sm font-sans font-medium focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)]"
              >
                <option value="">选择分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={
                  entryType === 'review' ? "今天学到了什么？有什么可以改进的？" :
                  entryType === 'success' ? "今天取得了什么小成就？值得庆祝的事情？" :
                  "今天发生了什么？"
                }
                className="w-full min-h-[120px] p-4 bg-transparent border-none resize-none focus:ring-0 text-lg placeholder:text-[var(--text-muted)] font-sans"
              />
              {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`absolute bottom-4 right-4 p-3 rounded-full transition-all shadow-sm ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse' 
                      : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)] border border-[var(--border)]'
                  }`}
                  title={isRecording ? "停止录音" : "语音输入"}
                >
                  {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>
              )}
            </div>
            
            {image && (
              <div className="relative mb-4 rounded-2xl overflow-hidden group">
                <img src={image} alt="Upload preview" className="w-full max-h-[400px] object-cover" />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 border-t border-[var(--border-light)]">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-primary)] rounded-full transition-colors flex items-center gap-2"
                >
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-sm font-sans">添加图片</span>
                </button>
              </div>
              
              <button
                type="submit"
                disabled={isSubmitting || (!content.trim() && !image)}
                className="px-6 py-2 bg-[var(--accent)] text-white rounded-full font-sans font-medium hover:bg-[var(--accent-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? '保存中...' : '写日记'}
              </button>
            </div>
          </form>
        </motion.div>
        )}

        {/* Search Bar */}
        {(viewMode === 'list' || viewMode === 'calendar') && (
        <div className="mb-8 flex gap-3">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-[var(--text-muted)]" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索日记..."
              className="w-full pl-11 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-sans shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-[var(--text-muted)] hover:text-[var(--accent)]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          {viewMode === 'list' && (
            <input
              type="date"
              value={diaryDateFilter}
              onChange={(e) => setDiaryDateFilter(e.target.value)}
              className="px-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 focus:border-[var(--accent)] transition-all font-sans shadow-sm text-[var(--text-primary)]"
            />
          )}
        </div>
        )}

        {/* Entries List */}
        {(viewMode === 'list' || viewMode === 'calendar') && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Sidebar - Categories */}
          <div className="md:col-span-3 space-y-6">
            <div className="bg-[var(--bg-secondary)] rounded-3xl p-2 border border-[var(--border)] shadow-sm">
              <div className="px-4 py-3 border-b border-[var(--border-light)] mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">我的文件夹</h3>
              </div>
              <nav className="space-y-0.5">
                <div 
                  onClick={() => setActiveCategory('all')}
                  className={`notes-sidebar-item ${activeCategory === 'all' ? 'active' : ''}`}
                >
                  <Layout className="w-4 h-4" />
                  <span>全部日记</span>
                  <span className="ml-auto text-xs opacity-60">{entries.length}</span>
                </div>
                <div 
                  onClick={() => setActiveCategory('review')}
                  className={`notes-sidebar-item ${activeCategory === 'review' ? 'active' : ''}`}
                >
                  <Target className="w-4 h-4" />
                  <span>每日复盘</span>
                  <span className="ml-auto text-xs opacity-60">{entries.filter(e => e.type === 'review').length}</span>
                </div>
                <div 
                  onClick={() => setActiveCategory('success')}
                  className={`notes-sidebar-item ${activeCategory === 'success' ? 'active' : ''}`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>成功日记</span>
                  <span className="ml-auto text-xs opacity-60">{entries.filter(e => e.type === 'success').length}</span>
                </div>
                
                <div className="h-px bg-[var(--border-light)] my-2 mx-2" />
                
                {categories.map(cat => (
                  <div 
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.name)}
                    className={`notes-sidebar-item group ${activeCategory === cat.name ? 'active' : ''}`}
                  >
                    <Folder className="w-4 h-4" />
                    <span className="truncate">{cat.name}</span>
                    <span className="ml-auto text-xs opacity-60 group-hover:hidden">{entries.filter(e => e.category === cat.name).length}</span>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }}
                      className="ml-auto hidden group-hover:block p-1 hover:text-red-500 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </nav>
              
                {isCreatingCategory ? (
                  <div className="px-3 py-2">
                    <input
                      autoFocus
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateCategory();
                          setIsCreatingCategory(false);
                        }
                        if (e.key === 'Escape') setIsCreatingCategory(false);
                      }}
                      onBlur={() => {
                        if (newCategoryName.trim()) handleCreateCategory();
                        setIsCreatingCategory(false);
                      }}
                      placeholder="文件夹名称"
                      className="w-full px-3 py-1.5 text-sm bg-[var(--bg-primary)] border border-[var(--accent)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 font-sans"
                    />
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsCreatingCategory(true)}
                    className="w-full mt-2 flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>新建文件夹</span>
                  </button>
                )}
            </div>

            <div className="bg-[var(--bg-secondary)] rounded-3xl p-6 border border-[var(--border)] shadow-sm">
              <h3 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">统计</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">总计</span>
                  <span className="text-sm font-bold">{entries.length} 篇</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-secondary)]">本月</span>
                  <span className="text-sm font-bold">
                    {entries.filter(e => new Date(e.created_at).getMonth() === new Date().getMonth()).length} 篇
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main List */}
          <div className="md:col-span-9 space-y-4">
            <div className="bg-[var(--bg-secondary)] rounded-3xl shadow-sm border border-[var(--border)] overflow-hidden">
              <div className="divide-y divide-[var(--border-light)]">
                <AnimatePresence mode="popLayout">
                  {displayedEntries.length > 0 ? (
                    displayedEntries.map((entry) => (
                      <motion.div
                        key={entry.id}
                        layout
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={`notes-list-item group ${selectedDate && formatDate(entry.created_at) === formatDate(selectedDate.toISOString()) ? 'active' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {entry.type && entry.type !== 'normal' && (
                                <span className={`w-2 h-2 rounded-full shrink-0 ${entry.type === 'review' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                              )}
                              <h4 className="text-base font-bold truncate text-[var(--text-primary)]">
                                {entry.content.split('\n')[0] || '无标题'}
                              </h4>
                              {entry.image && <ImageIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />}
                            </div>
                            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                              <span className="whitespace-nowrap font-medium">{formatTime(entry.created_at)}</span>
                              <p className="truncate opacity-70">
                                {entry.summary || entry.content.split('\n').slice(1).join(' ').trim() || '没有更多内容'}
                              </p>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                              <span className="text-[10px] text-[var(--text-muted)] font-sans">{formatDate(entry.created_at)}</span>
                              {entry.category && (
                                <div className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded">
                                  <Folder className="w-2.5 h-2.5" />
                                  {entry.category}
                                </div>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => confirmDelete(entry.id)}
                              className="p-2 text-[var(--text-muted)] hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 hidden group-hover:block animate-in fade-in slide-in-from-top-2 duration-300">
                           {entry.image && (
                            <div className="mb-4 rounded-xl overflow-hidden max-h-60 border border-[var(--border-light)]">
                              <img src={entry.image} alt="" className="w-full h-full object-cover" />
                            </div>
                           )}
                           <div 
                            className="text-sm text-[var(--text-secondary)] prose prose-sm max-w-none"
                            style={{ color: fontColor || 'var(--text-primary)', fontSize: `${fontSize}px` }}
                           >
                            <Markdown>{entry.content}</Markdown>
                           </div>
                           {entry.tags && (
                             <div className="mt-4 flex flex-wrap gap-2">
                               {JSON.parse(entry.tags).map((tag: string) => (
                                 <span key={tag} className="text-[10px] bg-[var(--bg-tertiary)] text-[var(--text-muted)] px-2 py-0.5 rounded-full border border-[var(--border-light)]">#{tag}</span>
                               ))}
                             </div>
                           )}
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="p-12 text-center">
                      <div className="w-16 h-16 bg-[var(--bg-primary)] rounded-full flex items-center justify-center mx-auto mb-4">
                        <FileText className="w-8 h-8 text-[var(--text-muted)]" />
                      </div>
                      <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">没有找到日记</h3>
                      <p className="text-[var(--text-secondary)]">尝试更换分类或搜索关键词</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {entryToDelete !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-secondary)] rounded-3xl shadow-xl p-6 max-w-sm w-full border border-[var(--border)]"
            >
              <h3 className="text-xl font-bold text-[var(--text-primary)] font-sans mb-2">确认删除</h3>
              <p className="text-[var(--text-secondary)] font-sans mb-6">您确定要删除这篇日记吗？此操作无法撤销。</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setEntryToDelete(null)}
                  className="px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] font-sans font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={executeDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 font-sans font-medium transition-colors"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {expenseToDelete !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-secondary)] rounded-3xl shadow-xl p-6 max-w-sm w-full border border-[var(--border)]"
            >
              <h3 className="text-xl font-bold text-[var(--text-primary)] font-sans mb-2">确认删除</h3>
              <p className="text-[var(--text-secondary)] font-sans mb-6">您确定要删除这笔支出记录吗？此操作无法撤销。</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setExpenseToDelete(null)}
                  className="px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] font-sans font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={executeDeleteExpense}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 font-sans font-medium transition-colors"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {categoryToDelete !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[var(--bg-secondary)] rounded-3xl shadow-xl p-6 max-w-sm w-full border border-[var(--border)]"
            >
              <h3 className="text-xl font-bold text-[var(--text-primary)] font-sans mb-2">确认删除分类</h3>
              <p className="text-[var(--text-secondary)] font-sans mb-6">您确定要删除这个分类吗？日记条目不会被删除，但将不再属于此分类。</p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setCategoryToDelete(null)}
                  className="px-4 py-2 rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] font-sans font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={executeDeleteCategory}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 font-sans font-medium transition-colors"
                >
                  确定删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
