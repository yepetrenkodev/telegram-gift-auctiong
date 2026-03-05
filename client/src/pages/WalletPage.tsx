import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Wallet, Star, Plus, ArrowUpRight, ArrowDownLeft, CreditCard, History, Sparkles, Loader2, Crown, Gem, Zap, CheckCircle } from 'lucide-react'
import { useTelegram, useTonPayment, useAuth } from '../hooks'
import { useUserStore, useNotificationStore } from '../store'

const API_URL = import.meta.env.VITE_API_URL || '/api'

const starPackages = [
  { amount: 100, price: 1, popular: false, bonus: 0 },
  { amount: 500, price: 4.5, popular: false, bonus: 5 },
  { amount: 1000, price: 8, popular: true, bonus: 10 },
  { amount: 2500, price: 18, popular: false, bonus: 15 },
  { amount: 5000, price: 35, popular: false, bonus: 20 },
  { amount: 10000, price: 65, popular: false, bonus: 25 },
]

type TabType = 'buy' | 'history'

export function WalletPage() {
  const { hapticFeedback, showAlert } = useTelegram()
  const user = useUserStore((s) => s.user)
  const setUser = useUserStore((s) => s.setUser)
  const { addNotification } = useNotificationStore()
  const { mutateAsync: tonPayment, isPending: isTonPending } = useTonPayment()
  const { refetch: refetchAuth } = useAuth()
  
  const [activeTab, setActiveTab] = useState<TabType>('buy')
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleBuyStars = async (amount: number) => {
    try {
      hapticFeedback('impact', 'medium')
      setIsProcessing(true)
      
      // Get dev user ID for authorization
      const devUserId = localStorage.getItem('dev_user_id')
      
      // Call real API to add stars to database
      const response = await fetch(`${API_URL}/payments/stars`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(devUserId && { 'X-Dev-User-Id': devUserId }),
        },
        body: JSON.stringify({ amount }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Payment failed')
      }
      
      // Refresh user data to get updated balance from server
      await refetchAuth()
      
      hapticFeedback('notification', 'success')
      addNotification({
        type: 'success',
        title: 'Оплата прошла успешно!',
        message: `+${amount.toLocaleString()} ⭐ добавлено на ваш баланс`
      })
      
      setSelectedPackage(null)
    } catch (error: any) {
      console.error('Payment error:', error)
      addNotification({
        type: 'error',
        title: 'Ошибка оплаты',
        message: error.message || 'Не удалось купить звёзды'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleTonDeposit = async () => {
    try {
      hapticFeedback('impact', 'medium')
      // This would open TON wallet connect
      addNotification({
        type: 'info',
        title: 'TON Connect',
        message: 'Функция в разработке'
      })
    } catch (error: any) {
      showAlert(error.message || 'Ошибка')
    }
  }

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div 
          className="p-3.5 rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.3)',
            boxShadow: '0 0 30px rgba(212, 175, 55, 0.15)'
          }}
        >
          <Wallet className="w-7 h-7 text-yellow-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gradient-gold">Кошелек</h1>
          <p className="text-gray-500 text-sm">Управление балансом</p>
        </div>
      </motion.div>

      {/* Premium Balance Cards */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="grid grid-cols-2 gap-3"
      >
        {/* Stars balance */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -2 }}
          className="premium-card p-5 relative overflow-hidden"
        >
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(212, 175, 55, 0.6) 0%, transparent 70%)' }} />
          <div className="relative">
            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400 mb-3" />
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Звезды</p>
            <p className="text-2xl font-bold text-gradient-gold">
              {user?.balance.toLocaleString() || 0}
            </p>
          </div>
        </motion.div>

        {/* TON balance */}
        <motion.div 
          whileHover={{ scale: 1.02, y: -2 }}
          className="premium-card p-5 relative overflow-hidden"
        >
          <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-30"
               style={{ background: 'radial-gradient(circle, rgba(59, 130, 246, 0.6) 0%, transparent 70%)' }} />
          <div className="relative">
            <Gem className="w-8 h-8 text-blue-400 mb-3" />
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">TON</p>
            <p className="text-2xl font-bold text-blue-400">
              {user?.tonBalance.toFixed(2) || '0.00'}
            </p>
          </div>
        </motion.div>
      </motion.div>

      {/* Premium Tab Switcher */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex gap-2 p-1.5 rounded-2xl"
        style={{ background: 'var(--bg-tertiary)' }}
      >
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('buy')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all
            ${activeTab === 'buy'
              ? 'text-yellow-400'
              : 'text-gray-500'}
          `}
          style={activeTab === 'buy' ? {
            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.2)'
          } : {}}
        >
          <Plus className="w-5 h-5" />
          Пополнить
        </motion.button>
        
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={() => setActiveTab('history')}
          className={`
            flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold transition-all
            ${activeTab === 'history'
              ? 'text-purple-400'
              : 'text-gray-500'}
          `}
          style={activeTab === 'history' ? {
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(236, 72, 153, 0.1) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.2)'
          } : {}}
        >
          <History className="w-5 h-5" />
          История
        </motion.button>
      </motion.div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'buy' ? (
          <motion.div
            key="buy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-5"
          >
            {/* Stars packages */}
            <div>
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                Купить звезды
              </h3>
              
              <div className="grid grid-cols-2 gap-3">
                {starPackages.map((pkg) => (
                  <motion.button
                    key={pkg.amount}
                    whileHover={{ scale: 1.03, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setSelectedPackage(pkg.amount)
                      hapticFeedback('selection')
                    }}
                    className="premium-card p-4 text-left relative overflow-hidden transition-all"
                    style={{
                      borderColor: selectedPackage === pkg.amount 
                        ? 'rgba(212, 175, 55, 0.5)' 
                        : pkg.popular 
                        ? 'rgba(139, 92, 246, 0.3)' 
                        : undefined,
                      boxShadow: selectedPackage === pkg.amount 
                        ? '0 0 30px rgba(212, 175, 55, 0.2)' 
                        : undefined
                    }}
                  >
                    {pkg.popular && (
                      <div className="absolute top-2 right-2">
                        <span 
                          className="px-2.5 py-1 text-white text-[10px] font-bold uppercase tracking-wider rounded-full flex items-center gap-1"
                          style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
                        >
                          <Crown className="w-3 h-3" />
                          Popular
                        </span>
                      </div>
                    )}
                    
                    {pkg.bonus > 0 && (
                      <div className="absolute top-2 left-2">
                        <span 
                          className="px-2 py-0.5 text-green-400 text-[10px] font-bold rounded-full"
                          style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
                        >
                          +{pkg.bonus}%
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mb-2 mt-4">
                      <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
                      <span className="text-2xl font-bold text-gradient-gold">{pkg.amount.toLocaleString()}</span>
                    </div>
                    
                    <p className="text-gray-400 font-medium">${pkg.price}</p>
                    
                    {selectedPackage === pkg.amount && (
                      <motion.div
                        layoutId="selected-pkg"
                        className="absolute inset-0 rounded-[20px] pointer-events-none"
                        style={{ border: '2px solid rgba(212, 175, 55, 0.6)' }}
                      />
                    )}
                  </motion.button>
                ))}
              </div>

              {/* Premium Buy button */}
              <motion.button
                whileHover={selectedPackage && !isProcessing ? { scale: 1.02 } : {}}
                whileTap={selectedPackage && !isProcessing ? { scale: 0.98 } : {}}
                onClick={() => selectedPackage && !isProcessing && handleBuyStars(selectedPackage)}
                disabled={!selectedPackage || isProcessing}
                className="w-full py-4 mt-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all"
                style={selectedPackage ? {
                  background: isProcessing 
                    ? 'linear-gradient(135deg, #4a90a4 0%, #63b3d1 50%, #4a90a4 100%)'
                    : 'linear-gradient(135deg, #d4af37 0%, #f5d063 50%, #d4af37 100%)',
                  boxShadow: isProcessing
                    ? '0 0 30px rgba(74, 144, 164, 0.3)'
                    : '0 0 30px rgba(212, 175, 55, 0.3)',
                  color: '#1a1a2e'
                } : {
                  background: 'var(--bg-tertiary)',
                  color: '#6b7280'
                }}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Обработка оплаты...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    {selectedPackage ? `Купить ${selectedPackage.toLocaleString()} ⭐` : 'Выберите пакет'}
                  </>
                )}
              </motion.button>
            </div>

            {/* TON section */}
            <div className="pt-5 border-t border-white/5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Gem className="w-5 h-5 text-blue-400" />
                TON Кошелек
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleTonDeposit}
                  className="premium-card p-5 flex flex-col items-center gap-3 transition-all"
                  style={{ borderColor: 'rgba(16, 185, 129, 0.2)' }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.3)'
                    }}
                  >
                    <ArrowDownLeft className="w-6 h-6 text-green-400" />
                  </div>
                  <span className="text-white font-semibold">Пополнить</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="premium-card p-5 flex flex-col items-center gap-3 transition-all"
                  style={{ borderColor: 'rgba(59, 130, 246, 0.2)' }}
                >
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.3)'
                    }}
                  >
                    <ArrowUpRight className="w-6 h-6 text-blue-400" />
                  </div>
                  <span className="text-white font-semibold">Вывести</span>
                </motion.button>
              </div>
            </div>

            {/* Premium Promo */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative overflow-hidden rounded-2xl p-5 shine shine-gold"
              style={{
                background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
                border: '1px solid rgba(212, 175, 55, 0.2)'
              }}
            >
              <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-2xl opacity-30"
                   style={{ background: 'rgba(212, 175, 55, 0.5)' }} />
              <div className="relative flex items-start gap-3">
                <div 
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #d4af37, #f5d063)' }}
                >
                  <Zap className="w-5 h-5 text-yellow-900" />
                </div>
                <div>
                  <h4 className="font-bold text-white mb-1">Первое пополнение</h4>
                  <p className="text-gray-400 text-sm">Получите +20% бонусных звезд при первой покупке от 500 ⭐</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="history"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-3"
          >
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-purple-400" />
              История транзакций
            </h3>
            
            {/* Mock transactions */}
            {[
              { type: 'deposit', amount: 1000, date: new Date(), description: 'Покупка звезд' },
              { type: 'bid', amount: -150, date: new Date(Date.now() - 86400000), description: 'Ставка на аукционе' },
              { type: 'win', amount: -500, date: new Date(Date.now() - 172800000), description: 'Выигрыш аукциона' },
            ].map((tx, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="premium-card p-4 flex items-center gap-4"
              >
                <div 
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{
                    background: tx.amount > 0 
                      ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)'
                      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%)',
                    border: tx.amount > 0 
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {tx.amount > 0 ? (
                    <ArrowDownLeft className="w-5 h-5 text-green-400" />
                  ) : (
                    <ArrowUpRight className="w-5 h-5 text-red-400" />
                  )}
                </div>
                
                <div className="flex-1">
                  <p className="text-white font-medium">{tx.description}</p>
                  <p className="text-gray-600 text-xs mt-0.5">{tx.date.toLocaleDateString('ru-RU')}</p>
                </div>
                
                <span className={`font-bold text-lg ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} ⭐
                </span>
              </motion.div>
            ))}
            
            <p className="text-center text-gray-600 text-sm py-6">
              Показаны последние транзакции
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
