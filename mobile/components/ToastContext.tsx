import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { Text, Animated, Platform, View } from 'react-native';
import { Portal } from 'react-native-paper';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (msg: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode, themes: any, isDark: boolean }> = ({ children, themes, isDark }) => {
  const [toast, setToast] = useState<{ msg: string, type: ToastType, visible: boolean }>({
    msg: '',
    type: 'success',
    visible: false
  });
  
  const toastOp = useRef(new Animated.Value(0)).current;
  const C = isDark ? themes.dark : themes.light;

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    setToast({ msg, type, visible: true });
    
    Animated.sequence([
      Animated.timing(toastOp, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2500),
      Animated.timing(toastOp, { toValue: 0, duration: 300, useNativeDriver: true })
    ]).start(() => setToast(prev => ({ ...prev, visible: false })));
  }, [toastOp]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Portal>
        {toast.visible && (
          <Animated.View style={{
            position: 'absolute', 
            bottom: Platform.OS === 'ios' ? 110 : 90, 
            alignSelf: 'center', 
            opacity: toastOp,
            backgroundColor: toast.type === 'error' ? 
              (isDark ? '#ef4444' : '#dc2626') : 
              (toast.type === 'info' ? (isDark ? '#f59e0b' : '#d97706') : (isDark ? '#22c55e' : '#16a34a')),
            paddingHorizontal: 24, 
            paddingVertical: 14, 
            borderRadius: 30, 
            elevation: 10,
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: 4 }, 
            shadowOpacity: 0.3, 
            shadowRadius: 8,
            flexDirection: 'row', 
            alignItems: 'center', 
            zIndex: 99999
          }}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 }}>{toast.msg}</Text>
          </Animated.View>
        )}
      </Portal>
    </ToastContext.Provider>
  );
};
