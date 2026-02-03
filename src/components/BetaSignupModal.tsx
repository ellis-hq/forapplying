import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, CheckCircle, Sparkles } from 'lucide-react';

type BetaSignupModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

const BetaSignupModal: React.FC<BetaSignupModalProps> = ({ isOpen, onClose }) => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        setIsSubmitting(true);
        setError(null);

        try {
            const { error: insertError } = await supabase
                .from('beta_signups')
                .insert({ email });

            if (insertError) {
                if (insertError.code === '23505') { // Unique violation
                    setSuccess(true); // Treat as success to not leak/discourage
                } else {
                    throw insertError;
                }
            } else {
                setSuccess(true);
            }
        } catch (err) {
            console.error('Error signing up for beta:', err);
            setError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden transform transition-all scale-100">

                {/* Decorative Top Bar */}
                <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition p-1 hover:bg-gray-100 rounded-full"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="p-8">
                    {success ? (
                        <div className="text-center py-6">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                <CheckCircle className="w-8 h-8" />
                            </div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">You're on the Pro waitlist!</h3>
                            <p className="text-gray-600 mb-6">
                                Thank you for your interest. We'll let you know as soon as Pro is ready.
                            </p>
                            <button
                                onClick={onClose}
                                className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium hover:bg-gray-800 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                            >
                                Close
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-4">
                                    <Sparkles className="w-6 h-6" />
                                </div>
                                <h2 className="text-2xl font-bold text-gray-900 mb-2">Join the Pro Waitlist</h2>
                                <p className="text-gray-600 text-sm leading-relaxed">
                                    Be the first to know when Forapplying Pro launches.
                                </p>
                                <ul className="text-left text-xs text-gray-600 mt-4 space-y-2">
                                    <li className="flex items-start gap-2">
                                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        More downloads included
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        Access to a future agent version of the app
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                        Early access to new features
                                    </li>
                                </ul>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label htmlFor="beta-email" className="sr-only">Email address</label>
                                    <input
                                        id="beta-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        placeholder="Enter your email address"
                                        className="w-full px-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition bg-gray-50 focus:bg-white"
                                    />
                                </div>

                                {error && (
                                    <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg flex items-center gap-2">
                                        <span className="w-1 h-4 bg-red-400 rounded-full block" />
                                        {error}
                                    </p>
                                )}

                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3.5 rounded-xl font-medium hover:from-indigo-700 hover:to-purple-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        'Join Pro Waitlist'
                                    )}
                                </button>
                            </form>

                            <p className="text-xs text-center text-gray-400 mt-6">
                                We respect your privacy. No spam, ever.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BetaSignupModal;
