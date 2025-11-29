
import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Loader2, Sparkles, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { getAIConfig, getSchoolNews, getBotContext } from '../services/storage';
import { BEHAVIOR_VIOLATIONS } from '../constants';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'model',
      text: 'مرحباً بك! أنا المساعد الذكي لمتوسطة عماد الدين زنكي. كيف يمكنني مساعدتك اليوم؟',
      timestamp: new Date()
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const config = getAIConfig();
      if (!config.apiKey) {
        throw new Error("API Key missing");
      }

      // 1. Gather Context
      const [news, botContext] = await Promise.all([
          getSchoolNews(),
          getBotContext()
      ]);
      
      const latestNews = news.slice(0, 3).map(n => `- ${n.title}: ${n.content}`).join('\n');
      const schoolName = localStorage.getItem('school_name') || "متوسطة عماد الدين زنكي";

      // 2. Prepare System Instruction
      const systemInstruction = `
        أنت مساعد ذكي ومحترم لمدرسة "${schoolName}".
        جمهورك هم: أولياء الأمور، المعلمون، والطلاب.
        
        معلومات أساسية عن المدرسة (قاعدة المعرفة):
        ${botContext || "لا توجد معلومات إضافية محددة، أجب بناءً على المعلومات العامة للمدارس السعودية."}
        
        آخر أخبار المدرسة:
        ${latestNews || "لا توجد أخبار حديثة."}
        
        لائحة السلوك (أمثلة):
        مخالفات الدرجة الأولى: ${BEHAVIOR_VIOLATIONS[0].violations.join(', ')}.
        مخالفات الدرجة الرابعة: ${BEHAVIOR_VIOLATIONS[3].violations.join(', ')}.

        تعليماتك:
        1. أجب باختصار ولطف.
        2. استخدم اللغة العربية الفصحى المبسطة.
        3. إذا سألك أحد عن "كيف أقدم عذر"، وجهه لصفحة "تقديم عذر" في الموقع.
        4. إذا سألك ولي أمر عن ابنه، ذكره بضرورة تسجيل الدخول أولاً في "بوابة ولي الأمر".
        5. اعتمد في إجابتك أولاً على "معلومات أساسية عن المدرسة" المذكورة أعلاه.
      `;

      // 3. Call Gemini
      const ai = new GoogleGenAI({ apiKey: config.apiKey });
      const model = 'gemini-2.5-flash';
      
      // Construct history for context
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const chat = ai.chats.create({
        model: model,
        config: { systemInstruction },
        history: history
      });

      const result = await chat.sendMessage({ message: userMsg.text });
      const responseText = result.text || "عذراً، لم أستطع فهم ذلك.";

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMsg]);

    } catch (error) {
      console.error("Chat Error", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "عذراً، أواجه مشكلة في الاتصال حالياً. يرجى المحاولة لاحقاً.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-50 p-4 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ${isOpen ? 'bg-red-500 rotate-90' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:scale-110'}`}
      >
        {isOpen ? <X className="text-white" size={28} /> : <MessageCircle className="text-white" size={28} />}
      </button>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-24 right-6 z-50 w-[350px] md:w-[400px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transition-all duration-300 origin-bottom-right flex flex-col ${isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-0 opacity-0 translate-y-10 pointer-events-none'}`}
        style={{ height: '500px', maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="bg-slate-900 p-4 flex items-center gap-3 text-white">
          <div className="bg-white/10 p-2 rounded-full">
            <Bot size={24} className="text-blue-300" />
          </div>
          <div>
            <h3 className="font-bold text-sm">المساعد المدرسي</h3>
            <p className="text-[10px] text-slate-300 flex items-center gap-1">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> متصل الآن (AI)
            </p>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div 
                className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none shadow-sm'
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-bl-none shadow-sm flex items-center gap-2">
                <Sparkles size={16} className="text-purple-500 animate-pulse" />
                <span className="text-xs text-slate-400 font-bold">جاري الكتابة...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 bg-white border-t border-slate-100">
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="اكتب سؤالك هنا..."
              className="flex-1 bg-transparent outline-none text-sm px-2 text-slate-700"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin"/> : <Send size={18} />}
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-2">
            يعمل بواسطة الذكاء الاصطناعي، قد يخطئ أحياناً.
          </p>
        </div>
      </div>
    </>
  );
};

export default ChatBot;
