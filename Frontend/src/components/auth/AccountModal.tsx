import React from 'react';
import { User as UserIcon, Mail, Calendar, ShieldCheck, LogOut, Package } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../common/Toast';

interface AccountModalProps {
  onNavigateOrders?: () => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ onNavigateOrders }) => {
  const { user, accountModalOpen, setAccountModalOpen, logout } = useAuth();
  const { showToast } = useToast();

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    showToast('Signed out of EasyCart', 'info');
  };

  return (
    <Modal
      isOpen={accountModalOpen}
      onClose={() => setAccountModalOpen(false)}
      maxWidth="md"
      title="Customer Profile & Privileges"
    >
      <div className="space-y-6">
        {/* User Card */}
        <div className="flex items-center gap-4 p-4 rounded-xl bg-ivory dark:bg-dark-card border border-softBorder dark:border-dark-border">
          <div className="w-14 h-14 rounded-xl bg-espresso text-porcelain dark:bg-bronze dark:text-espresso flex items-center justify-center font-serif font-bold text-xl shadow-luxury-sm shrink-0">
            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-serif text-base font-semibold text-espresso dark:text-porcelain truncate">
              {user.name}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-mutedGrey dark:text-dark-muted mt-0.5 truncate">
              <Mail className="w-3.5 h-3.5 text-bronze" />
              <span>{user.email}</span>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-bronze/15 text-espresso dark:text-bronze-gold border border-bronze/20">
              <ShieldCheck className="w-3 h-3 text-bronze" />
              <span>{user.role === 'admin' ? 'Store Administrator' : 'Verified Customer'}</span>
            </div>
          </div>
        </div>

        {/* Member Details */}
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-light/50 dark:bg-dark-elevated border border-softBorder dark:border-dark-border">
            <span className="text-mutedGrey dark:text-dark-muted flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-bronze" /> Account Identifier
            </span>
            <span className="font-mono font-semibold text-espresso dark:text-porcelain">
              EC-USER-{user.id}
            </span>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-stone-light/50 dark:bg-dark-elevated border border-softBorder dark:border-dark-border">
            <span className="text-mutedGrey dark:text-dark-muted flex items-center gap-2">
              <Calendar className="w-4 h-4 text-bronze" /> Member Since
            </span>
            <span className="font-semibold text-espresso dark:text-porcelain">
              {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'October 2026'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-2 border-t border-softBorder dark:border-dark-border">
          {onNavigateOrders && (
            <Button
              onClick={() => {
                setAccountModalOpen(false);
                onNavigateOrders();
              }}
              variant="secondary"
              className="w-full justify-start text-xs"
              leftIcon={<Package className="w-4 h-4 text-bronze" />}
            >
              View Order History &amp; Invoices
            </Button>
          )}

          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start text-xs text-rose-600 hover:text-rose-700 border-rose-200 dark:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20"
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign Out
          </Button>
        </div>
      </div>
    </Modal>
  );
};
