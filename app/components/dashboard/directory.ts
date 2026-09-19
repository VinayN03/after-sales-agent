"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaseStatus, Route } from "../../../agents/_agents/types";
import { getConversationId } from "./helpers";

export interface DirCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: "Standard" | "Silver" | "Gold" | "Platinum";
  memberSinceDays: number;
  lifetimeOrders: number;
  refunds90d: number;
  damageClaims90d: number;
  replacements90d: number;
  addressMismatch: boolean;
  preferredChannel: "email" | "sms" | "chat";
  payment: string;
  pastCases: Array<{ date: string; topic: string }>;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  riskScore: number;
  riskFlags: string[];
  openCases: number;
  totalCases: number;
}

export interface DirOrder {
  orderId: string;
  userId: string;
  customerName: string;
  items: Array<{ name: string; quantity: number; price: number }>;
  totalAmount: number;
  status: string;
  createdAt: string;
  deliveredAt?: string;
  trackingNumber?: string;
  carrier?: string;
  caseId?: string;
  caseStatus?: CaseStatus;
  caseRoute?: Route;
}

/** Customers and orders from /directory; refreshes on an interval so case status stays current. */
export function useDirectory(intervalMs = 6000) {
  const [customers, setCustomers] = useState<DirCustomer[]>([]);
  const [orders, setOrders] = useState<DirOrder[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/directory", {
        method: "POST",
        headers: { "Content-Type": "application/json", "makers-conversation-id": getConversationId() },
        body: "{}",
      });
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers ?? []);
        setOrders(data.orders ?? []);
      }
    } catch {
      // keep the last known data
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs]);

  return { customers, orders, loaded, refresh };
}
