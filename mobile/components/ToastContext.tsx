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

  const bgColor = isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)';
  const borderColor = toast.type === 'error' ? C.red : (toast.type === 'info' ? C.amber : C.green);

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
            backgroundColor: bgColor,
            paddingHorizontal: 20, 
            paddingVertical: 12, 
            borderRadius: 16, 
            borderWidth: 1,
            borderColor: borderColor + '40',
            elevation: 10,
            shadowColor: '#000', 
            shadowOffset: { width: 0, height: 8 }, 
            shadowOpacity: 0.2, 
            shadowRadius: 12,
            flexDirection: 'row', 
            alignItems: 'center', 
            zIndex: 99999,
          }}>
            <View style={{ 
              width: 8, 
              height: 8, 
              borderRadius: 4, 
              backgroundColor: borderColor, 
              marginRight: 12 
            }} />
            <Text style={{ 
              color: C.text, 
              fontWeight: '700', 
              fontSize: 14, 
              letterSpacing: 0.3 
            }}>{toast.msg}</Text>
          </Animated.View>
        )}
      </Portal>
    </ToastContext.Provider>
  );
};
