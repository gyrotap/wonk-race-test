export interface ViewerWallet {
  balance: number;
  currentBet: { slot: number; amount: number } | null;
}

export interface CashoutCode {
  code: string;
  balance: number;
  createdAt: number;
}

const STARTING_BALANCE = 100;
const PASSIVE_INCOME = 5; // tokens earned per race watched
const CODE_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'WONK-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  code += '-';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export class BettingSystem {
  private wallets = new Map<any, ViewerWallet>();
  private codes = new Map<string, CashoutCode>();

  getWallet(ws: any): ViewerWallet {
    if (!this.wallets.has(ws)) {
      this.wallets.set(ws, { balance: STARTING_BALANCE, currentBet: null });
    }
    return this.wallets.get(ws)!;
  }

  removeWallet(ws: any) {
    this.wallets.delete(ws);
  }

  placeBet(ws: any, slot: number, amount: number): { success: boolean; message: string } {
    const wallet = this.getWallet(ws);

    if (amount <= 0 || !Number.isFinite(amount)) return { success: false, message: 'Invalid amount' };
    amount = Math.floor(amount);
    if (amount > wallet.balance) return { success: false, message: 'Not enough tokens' };
    if (wallet.currentBet) return { success: false, message: 'Already bet this race' };
    if (slot < 0 || slot > 7) return { success: false, message: 'Invalid wonk' };

    wallet.balance -= amount;
    wallet.currentBet = { slot, amount };
    return { success: true, message: `Bet ${amount} on slot ${slot}` };
  }

  // Give passive income to all connected viewers after a race
  givePassiveIncome() {
    for (const [, wallet] of this.wallets) {
      wallet.balance += PASSIVE_INCOME;
    }
  }

  resolveBets(winnerSlot: number | null): Map<any, { won: boolean; payout: number }> {
    const results = new Map<any, { won: boolean; payout: number }>();

    for (const [ws, wallet] of this.wallets) {
      if (!wallet.currentBet) continue;

      if (winnerSlot !== null && wallet.currentBet.slot === winnerSlot) {
        const payout = wallet.currentBet.amount * 8;
        wallet.balance += payout;
        results.set(ws, { won: true, payout });
      } else {
        results.set(ws, { won: false, payout: 0 });
      }

      wallet.currentBet = null;
    }

    return results;
  }

  cashout(ws: any): string | null {
    const wallet = this.getWallet(ws);
    if (wallet.balance <= 0) return null;

    const code = generateCode();
    this.codes.set(code, {
      code,
      balance: wallet.balance,
      createdAt: Date.now(),
    });

    return code;
  }

  redeemCode(ws: any, code: string): { success: boolean; balance: number; message: string } {
    const upperCode = code.toUpperCase().trim();
    const stored = this.codes.get(upperCode);

    if (!stored) return { success: false, balance: 0, message: 'Invalid code' };
    if (Date.now() - stored.createdAt > CODE_EXPIRY_MS) {
      this.codes.delete(upperCode);
      return { success: false, balance: 0, message: 'Code expired' };
    }

    const wallet = this.getWallet(ws);
    wallet.balance += stored.balance;
    this.codes.delete(upperCode);

    return { success: true, balance: wallet.balance, message: `Redeemed ${stored.balance} tokens!` };
  }
}
