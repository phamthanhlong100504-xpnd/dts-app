import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
}

export const Button = ({ title, className, ...rest }: ButtonProps) => {
  return (
    <TouchableOpacity 
      className={`bg-blue-500 py-3 px-6 rounded-lg active:bg-blue-600 items-center ${className}`}
      {...rest}
    >
      <Text className="text-white font-semibold text-base">{title}</Text>
    </TouchableOpacity>
  );
};
