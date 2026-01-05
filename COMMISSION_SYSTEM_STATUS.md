# Commission System Status

## ✅ What's Done

### Property Commission Configuration
- **Location**: `models/Property.js`
- **Fields**:
  - `commissionType` (PERCENTAGE, FIXED_AMOUNT)
  - `commissionPercentage` (e.g., 5.50 for 5.5%)
  - `commissionFixedAmount` (fixed dollar amount)
  - `commissionFrequency` (WEEKLY, MONTHLY, etc.)
  - `commissionNotes` (additional terms)
  - `platformFeePercentage` (default 20%, or 5% if no commission)

**This is just the CONFIGURATION** - it tells the system HOW to calculate commissions, but doesn't track actual commission earnings.

---

## ❌ What's Missing

### 1. Commission Record Models

#### AgentCommission Model
Tracks actual commission earnings per payment period.

**Fields Needed**:
- `invoiceNumber` (unique)
- `leaseId`, `agentId`, `propertyId`
- `rentPaymentId` (link to rent payment)
- `month`, `year` (commission period)
- `baseRentAmount` (rent amount commission is based on)
- `commissionType`, `commissionRate`, `commissionFixed`
- `grossCommission` (before platform fee)
- `platformFee` (deducted from commission)
- `netCommission` (agent's actual earnings)
- `status` (UNPAID, PAID, PARTIAL)
- `amountPaid`, `dueDate`, `paidAt`
- `paymentMethod`, `paymentReference`

#### PlatformCommission Model
Tracks platform fees collected from agent commissions.

**Fields Needed**:
- `invoiceNumber` (unique)
- `agentId`, `leaseId`
- `month`, `year`
- `agentCommissionAmount` (base commission)
- `commissionType`, `commissionRate`, `commissionFixed`
- `platformFeeAmount` (actual fee collected)
- `status` (PENDING, PAID)
- `paidAt`, `paymentMethod`, `paymentReference`

#### AgencyCommission Model (for agency agents)
Tracks agency earnings from agent commissions.

**Fields Needed**:
- Similar structure to AgentCommission
- `agencyId` (which agency earns)
- `agentId` (which agent generated it)
- Agency's share calculation
- Platform fee on agency commission

---

### 2. Rent Payment Models

#### RentPayment Model
Tracks when tenants pay rent.

**Fields Needed**:
- `leaseId`, `tenantId`, `propertyId`
- `month`, `year` (payment period)
- `baseRentAmount`, `totalAmount` (with fees)
- `status` (PENDING, PAID, OVERDUE, PARTIAL)
- `dueDate`, `paidAt`
- `paymentMethod`, `paymentReference`
- Links to commission records

#### LandlordPayment Model
Tracks payments made to landlords.

**Fields Needed**:
- `leaseId`, `landlordId`, `propertyId`
- `month`, `year`
- `baseRentAmount`
- `agentCommission` (deducted)
- `adjustments` (deposits, fees, repairs)
- `netAmount` (final amount to landlord)
- `status`, `dueDate`, `paidAt`
- `bankAccountId` (which account to pay)

---

### 3. Commission Calculation Logic

**When Rent is Paid**:
1. Calculate agent commission from property settings
2. Calculate platform fee (20% of commission, or 5% of rent if no commission)
3. Create AgentCommission record
4. Create PlatformCommission record
5. If agency agent: Create AgencyCommission record
6. Calculate LandlordPayment (rent - commission + adjustments)

**Key Functions Needed**:
- `generateCommissionForRentPayment(rentPaymentId)`
- `calculateCommissions(rentAmount, propertySettings)`
- `markCommissionAsPaid(commissionId, paymentDetails)`

---

### 4. Commission APIs & Services

**Endpoints Needed**:
- `GET /commissions` - List agent commissions
- `GET /commissions/:id` - Get commission details
- `PATCH /commissions/:id/pay` - Mark commission as paid
- `GET /platform-commissions` - Platform fee tracking
- `GET /agency-commissions` - Agency commission tracking

**Services Needed**:
- `commissionService.js` - Commission calculation & CRUD
- `rentPaymentService.js` - Rent payment processing
- `landlordPaymentService.js` - Landlord payment processing

---

## 📊 Commission Flow

```
Rent Payment (Tenant pays $1,000)
    ↓
Calculate Commission (10% = $100)
    ↓
Calculate Platform Fee (20% of $100 = $20)
    ↓
Create Records:
    ├─ AgentCommission: $100 gross, $20 fee, $80 net
    ├─ PlatformCommission: $20 collected
    └─ LandlordPayment: $1,000 - $100 = $900 to landlord
```

---

## 🎯 Next Steps

1. **Create Commission Models** (AgentCommission, PlatformCommission, AgencyCommission)
2. **Create Payment Models** (RentPayment, LandlordPayment)
3. **Build Commission Calculation Service**
4. **Build Rent Payment Processing**
5. **Create Commission APIs**
6. **Build Commission Dashboard/Reports**

---

## 💡 Summary

**Property Commission Settings** = ✅ DONE (configuration only)
**Commission Tracking System** = ❌ NOT DONE (needs full implementation)

The property settings tell us HOW to calculate commissions, but we need separate models and logic to TRACK and PAY commissions when rent is actually received.

