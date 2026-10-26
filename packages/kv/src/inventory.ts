import { valkey } from "./index.js";

/**
 * Option A: Bulletproof Dynamic Stock Reservation using Valkey 9.1 HEXPIRE
 *
 * Keys:
 * - stock:physical:<sku> (Integer: total confirmed physical inventory)
 * - stock:holds:<sku>    (Hash: holderId -> quantity reserved)
 *
 * Why this prevents the HEXPIRE trap:
 * Instead of keeping an independent 'available' counter that drifts when HEXPIRE
 * silently purges an entry, available stock is calculated dynamically:
 * available = total_physical_stock - sum(HVALS stock:holds:<sku>).
 * As soon as HEXPIRE drops an expired user field, stock is instantly freed!
 */
const RESERVE_STOCK_LUA = `
local physical_key = KEYS[1]
local holds_key = KEYS[2]
local holder_id = ARGV[1]
local requested_qty = tonumber(ARGV[2])
local ttl_seconds = tonumber(ARGV[3])

local physical_stock = tonumber(redis.call('GET', physical_key) or '0')

-- Sum active holds
local active_holds = redis.call('HVALS', holds_key)
local total_held = 0
for _, val in ipairs(active_holds) do
    total_held = total_held + tonumber(val)
end

-- Subtract existing hold from same user if updating
local existing_user_hold = tonumber(redis.call('HGET', holds_key, holder_id) or '0')
local net_demand = requested_qty - existing_user_hold

if (total_held + net_demand) > physical_stock then
    return {0, physical_stock - total_held} -- 0 = Failure, insufficient stock
end

-- Record hold
redis.call('HSET', holds_key, holder_id, requested_qty)

-- Valkey 9.1 Hash Field Expiration (HEXPIRE)
redis.call('HEXPIRE', holds_key, ttl_seconds, 'FIELDS', 1, holder_id)

local new_available = physical_stock - (total_held + net_demand)
return {1, new_available} -- 1 = Success
`;

export async function reserveInventory(params: {
  sku: string;
  holderId: string;
  quantity: number;
  ttlSeconds?: number;
}): Promise<{ success: boolean; availableStock: number }> {
  const { sku, holderId, quantity, ttlSeconds = 600 } = params;
  const physicalKey = `stock:physical:${sku}`;
  const holdsKey = `stock:holds:${sku}`;

  const result = (await valkey.eval(
    RESERVE_STOCK_LUA,
    2,
    physicalKey,
    holdsKey,
    holderId,
    quantity.toString(),
    ttlSeconds.toString(),
  )) as [number, number];

  const [status, availableStock] = result;
  return {
    success: status === 1,
    availableStock,
  };
}

export async function commitInventoryPurchase(params: {
  sku: string;
  holderId: string;
  quantity: number;
}): Promise<void> {
  const { sku, holderId, quantity } = params;
  const physicalKey = `stock:physical:${sku}`;
  const holdsKey = `stock:holds:${sku}`;

  const pipeline = valkey.pipeline();
  // Deduct physical stock
  pipeline.decrby(physicalKey, quantity);
  // Release user hold
  pipeline.hdel(holdsKey, holderId);
  await pipeline.exec();
}

export async function releaseInventoryHold(params: {
  sku: string;
  holderId: string;
}): Promise<void> {
  const { sku, holderId } = params;
  const holdsKey = `stock:holds:${sku}`;
  await valkey.hdel(holdsKey, holderId);
}
