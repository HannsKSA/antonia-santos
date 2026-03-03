'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function CommunityCounter() {
    const [count, setCount] = useState<number | null>(null);

    const fetchCount = async () => {
        const { count: profileCount, error } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true });

        if (!error && profileCount !== null) {
            setCount(profileCount);
        }
    };

    useEffect(() => {
        fetchCount();

        // Escuchar cambios en tiempo real en la tabla de perfiles
        const channel = supabase
            .channel('public:profiles_count')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'profiles'
            }, () => {
                fetchCount();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // Si el conteo es bajo, podemos mostrar un número base o simplemente el número real.
    // El usuario pidió que se actualice el "+500". 
    // Si el número real es menor de 500, tal vez deberíamos mostrar el real.
    // Para que se vea "pro", podemos hacer un efecto de conteo incremental algún día, 
    // pero por ahora la funcionalidad dinámica es lo principal.

    return (
        <div style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--accent)' }}>
            {count === null ? '...' : `+${count}`}
        </div>
    );
}
