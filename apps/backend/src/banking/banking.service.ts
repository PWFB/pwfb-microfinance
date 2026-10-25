import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BankingService {
  constructor(private readonly prisma: PrismaService) {}
  async onModuleInit(){await this.ensureAtmCardTable()}
  private async ensureAtmCardTable(){
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "CustomerAtmCard" ("id" TEXT PRIMARY KEY,"customerId" TEXT NOT NULL,"cardholderName" TEXT NOT NULL,"last4" TEXT NOT NULL,"cardNetwork" TEXT,"expiryMonth" INTEGER,"expiryYear" INTEGER,"status" TEXT NOT NULL DEFAULT 'ACTIVE',"providerAuthorizationCode" TEXT,"frontImage" BYTEA,"frontMimeType" TEXT,"backImage" BYTEA,"backMimeType" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CustomerAtmCard_customerId_idx" ON "CustomerAtmCard" ("customerId");`);
    await this.prisma.$executeRawUnsafe(`ALTER TABLE "CustomerAtmCard" ADD COLUMN IF NOT EXISTS "providerAuthorizationCode" TEXT;`);
    await this.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CustomerAtmCard_status_idx" ON "CustomerAtmCard" ("status");`);
  }
  async listInstitutions(){return this.prisma.bankInstitution.findMany({where:{active:true},orderBy:{name:'asc'}})}
  async searchInstitutions(search?:string){return this.prisma.bankInstitution.findMany({where:{active:true,...(search?{OR:[{name:{contains:search,mode:'insensitive'}},{shortName:{contains:search,mode:'insensitive'}},{code:{contains:search,mode:'insensitive'}}]}:{})},orderBy:{name:'asc'}})}
  async getCustomerAccounts(customerId:string){return this.prisma.customerBankAccount.findMany({where:{customerId},include:{institution:true},orderBy:[{isPrimary:'desc'},{createdAt:'desc'}]})}
  async addCustomerAccount(data:any){const customer=await this.prisma.customer.findUnique({where:{id:data.customerId}});if(!customer)throw new NotFoundException('Customer not found');const institution=await this.prisma.bankInstitution.findUnique({where:{id:data.institutionId}});if(!institution)throw new NotFoundException('Bank or payment institution not found');if(!institution.active)throw new BadRequestException('Bank or payment institution is inactive');if(data.isPrimary)await this.prisma.customerBankAccount.updateMany({where:{customerId:data.customerId},data:{isPrimary:false}});return this.prisma.customerBankAccount.create({data:{customerId:data.customerId,institutionId:data.institutionId,accountNumber:data.accountNumber,accountName:data.accountName,isPrimary:data.isPrimary??false,verifiedAt:data.verifiedAt??null},include:{institution:true}})}
  async getCustomerAtmCards(customerId:string){
    const customer=await this.prisma.customer.findUnique({where:{id:customerId},select:{id:true}});
    if(!customer)throw new NotFoundException('Customer not found');
    const cards=await this.prisma.customerAtmCard.findMany({where:{customerId},orderBy:{createdAt:'desc'}});
    return cards.map(({frontImage,backImage,providerAuthorizationCode,...card})=>({ ...card, hasFrontAttachment:Boolean(frontImage), hasBackAttachment:Boolean(backImage), hasReusableAuthorization:Boolean(providerAuthorizationCode) }));
  }
  async getCustomerAtmCardAttachment(customerId:string,cardId:string,side:'front'|'back'){
    const card=await this.prisma.customerAtmCard.findFirst({where:{id:cardId,customerId}});
    if(!card)throw new NotFoundException('ATM card not found');
    const data=side==='front'?card.frontImage:card.backImage;
    const mime=side==='front'?card.frontMimeType:card.backMimeType;
    if(!data||!mime)throw new NotFoundException('ATM card attachment not found');
    return {data:Buffer.from(data).toString('base64'),mimeType:mime};
  }
  async addCustomerAtmCard(data:any){
    const customer=await this.prisma.customer.findUnique({where:{id:data.customerId},select:{id:true,firstName:true,middleName:true,lastName:true}});
    if(!customer)throw new NotFoundException('Customer not found');
    const last4=String(data.last4||'').replace(/\D/g,'');
    if(!/^\d{4}$/.test(last4))throw new BadRequestException('ATM card last 4 digits are required');
    const cardholderName=[customer.firstName,customer.middleName,customer.lastName].filter((part:any)=>String(part||'').trim()).join(' ').replace(/\s+/g,' ').trim();
    if(cardholderName.length<2)throw new BadRequestException('A registered customer name is required before attaching an ATM card');
    const month=data.expiryMonth==null?null:Number(data.expiryMonth), year=data.expiryYear==null?null:Number(data.expiryYear);
    if(month!==null&&(!Number.isInteger(month)||month<1||month>12))throw new BadRequestException('Expiry month must be 1-12');
    if(year!==null&&(!Number.isInteger(year)||year<2000||year>2100))throw new BadRequestException('Expiry year is invalid');
    return this.prisma.customerAtmCard.create({data:{customerId:data.customerId,cardholderName,last4,cardNetwork:String(data.cardNetwork||'').trim()||null,expiryMonth:month,expiryYear:year,status:'ACTIVE',providerAuthorizationCode:null,frontImage:null,frontMimeType:null,backImage:null,backMimeType:null},select:{id:true,customerId:true,cardholderName:true,last4:true,cardNetwork:true,expiryMonth:true,expiryYear:true,status:true,createdAt:true,updatedAt:true}});
  }
  async removeCustomerAtmCard(customerId:string,cardId:string){const card=await this.prisma.customerAtmCard.findFirst({where:{id:cardId,customerId}});if(!card)throw new NotFoundException('ATM card not found');await this.prisma.customerAtmCard.delete({where:{id:card.id}});return {message:'ATM card removed'};}
  async getBranchVirtualAccounts(branchId:string){return this.prisma.branchVirtualAccount.findMany({where:{branchId},include:{institution:true,branch:true},orderBy:{createdAt:'desc'}})}
  async generateBranchVirtualAccount(branchId:string,institutionId:string){const branch=await this.prisma.branch.findUnique({where:{id:branchId}});if(!branch)throw new NotFoundException('Branch not found');const institution=await this.prisma.bankInstitution.findUnique({where:{id:institutionId}});if(!institution)throw new NotFoundException('Bank or payment institution not found');if(!institution.active)throw new BadRequestException('Bank or payment institution is inactive');const existing=await this.prisma.branchVirtualAccount.findUnique({where:{branchId_institutionId:{branchId,institutionId}},include:{institution:true,branch:true}});if(existing)return existing;let accountNumber='';do{accountNumber=`9${Date.now().toString().slice(-8)}${Math.floor(Math.random()*10)}`}while(await this.prisma.branchVirtualAccount.findUnique({where:{accountNumber}}));return this.prisma.branchVirtualAccount.create({data:{branchId,institutionId,accountNumber,accountName:`PWFB - ${branch.name}`,isGenerated:true,generatedAt:new Date()},include:{institution:true,branch:true}})}
  private amount(value:any){const n=Number(value);if(!Number.isFinite(n)||n<=0)throw new BadRequestException('Amount must be greater than zero');return Math.round(n*100)/100}
  private ref(prefix:string){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10).toUpperCase()}`}
  private async openPeriod(tx:any){let p=await tx.financialPeriod.findFirst({where:{status:'OPEN'},orderBy:{startDate:'desc'}});if(p)return p;const now=new Date();const end=new Date(now);end.setDate(end.getDate()+1);return tx.financialPeriod.create({data:{name:`Auto ${now.toISOString().slice(0,10)}`,startDate:now,endDate:end,status:'OPEN'}})}
  async recordBranchDeposit(data:{accountNumber:string;amount:number;reference?:string;narration?:string}){const amount=this.amount(data.amount);return this.prisma.$transaction(async tx=>{const account=await tx.branchVirtualAccount.findUnique({where:{accountNumber:data.accountNumber},include:{branch:true,institution:true}});if(!account)throw new NotFoundException('Branch virtual account not found');if(account.status!=='ACTIVE')throw new BadRequestException('Branch virtual account is not active');const period=await this.openPeriod(tx);const reference=data.reference?.trim()||this.ref('BDEP');const entry=await tx.cashbookEntry.create({data:{periodId:period.id,branchId:account.branchId,type:'CASH_IN',amount,reference,description:data.narration||`Virtual account deposit - ${account.accountNumber}`}});return{branch:account.branch,virtualAccount:account,institution:account.institution,entry}})}
  async getBranchLedger(branchId:string){const branch=await this.prisma.branch.findUnique({where:{id:branchId}});if(!branch)throw new NotFoundException('Branch not found');const entries=await this.prisma.cashbookEntry.findMany({where:{branchId},orderBy:{entryDate:'desc'}});const totalIn=entries.filter(e=>e.type==='CASH_IN').reduce((s,e)=>s+e.amount,0);const totalOut=entries.filter(e=>e.type==='CASH_OUT').reduce((s,e)=>s+e.amount,0);return{branch,entries,totalIn,totalOut,balance:totalIn-totalOut}}
  async getCustomerWallet(customerId:string){const customer=await this.prisma.customer.findUnique({where:{id:customerId}});if(!customer)throw new NotFoundException('Customer not found');return this.prisma.customerWallet.upsert({where:{customerId},create:{customerId},update:{}})}
  async getCustomerTransactions(customerId:string){const customer=await this.prisma.customer.findUnique({where:{id:customerId}});if(!customer)throw new NotFoundException('Customer not found');return this.prisma.walletTransaction.findMany({where:{customerId},orderBy:{createdAt:'desc'}})}
  async deposit(customerId: string, data: any) {
    const amount = this.amount(data.amount);
    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) throw new NotFoundException('Customer not found');

      const wallet = await tx.customerWallet.upsert({
        where: { customerId },
        create: { customerId, balance: 0 },
        update: {},
      });
      await tx.$queryRawUnsafe(
        'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
        wallet.id,
      );
      const lockedWallet = await tx.customerWallet.findUnique({ where: { id: wallet.id } });
      if (!lockedWallet) throw new NotFoundException('Customer wallet not found');
      if (lockedWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');

      const previousBalance = Math.round(Number(lockedWallet.balance) * 100) / 100;
      const newBalance = Math.round((previousBalance + amount) * 100) / 100;
      const updatedWallet = await tx.customerWallet.update({
        where: { id: lockedWallet.id },
        data: { balance: newBalance },
      });
      const provider = String(data.verificationProvider || data.provider || '').trim().toUpperCase() || null;
      const bankCode = String(data.bankCode || data.bank_code || '').trim() || null;
      const accountNumber = String(data.accountNumber || '').replace(/\D/g, '') || null;
      const accountName = String(data.accountName || '').trim() || null;
      const description = data.description ?? (accountName
        ? 'Bank deposit from ' + accountName + (bankCode ? ' • ' + bankCode : '') + (accountNumber ? ' • ' + accountNumber : '')
        : 'Wallet deposit');
      const transaction = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'DEPOSIT',
          amount,
          previousBalance,
          newBalance,
          reference: data.reference?.trim() || this.ref('DEP'),
          description,
          branchId: data.branchId,
          staffId: data.staffId,
          provider,
          providerReference: data.providerReference || null,
          status: 'COMPLETED',
          processedAt: new Date(),
        },
      });
      return { wallet: updatedWallet, transaction };
    });
  }
  async withdraw(customerId: string, data: any) {
    const amount = this.amount(data.amount);
    return this.prisma.$transaction(async (tx) => {
      const wallet = await tx.customerWallet.findUnique({ where: { customerId } });
      if (!wallet) throw new NotFoundException('Customer wallet not found');

      await tx.$queryRawUnsafe(
        'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
        wallet.id,
      );
      const lockedWallet = await tx.customerWallet.findUnique({ where: { id: wallet.id } });
      if (!lockedWallet) throw new NotFoundException('Customer wallet not found');
      if (lockedWallet.status !== 'ACTIVE') throw new BadRequestException('Customer wallet is not active');

      const previousBalance = Math.round(Number(lockedWallet.balance) * 100) / 100;
      if (previousBalance < amount) throw new BadRequestException('Insufficient wallet balance');
      const newBalance = Math.round((previousBalance - amount) * 100) / 100;
      const updatedWallet = await tx.customerWallet.update({
        where: { id: lockedWallet.id },
        data: { balance: newBalance },
      });
      const transaction = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'WITHDRAWAL',
          amount,
          previousBalance,
          newBalance,
          reference: data.reference?.trim() || this.ref('WDR'),
          description: data.description ?? 'Wallet withdrawal',
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });
      return { wallet: { ...lockedWallet, balance: newBalance }, transaction };
    });
  }
  async transfer(customerId: string, data: any) {
    const amount = this.amount(data.amount);
    const recipientCustomerId = String(data.recipientCustomerId || '').trim();
    if (!recipientCustomerId) throw new BadRequestException('Recipient customer is required');
    if (customerId === recipientCustomerId) throw new BadRequestException('You cannot transfer to the same customer');

    return this.prisma.$transaction(async (tx) => {
      // Customer-ID locks serialize transfers involving the same parties before
      // any wallet rows are touched. Sorting gives A->B and B->A the same order.
      const customerLockKeys = [customerId, recipientCustomerId].sort();
      for (const id of customerLockKeys) {
        await tx.$queryRawUnsafe(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          'CUSTOMER-WALLET-TRANSFER:' + id,
        );
      }

      const sender = await tx.customer.findUnique({ where: { id: customerId } });
      const recipient = await tx.customer.findUnique({ where: { id: recipientCustomerId } });
      if (!sender) throw new NotFoundException('Sender customer not found');
      if (!recipient) throw new NotFoundException('Recipient customer not found');

      const senderInitial = await tx.customerWallet.findUnique({ where: { customerId } });
      if (!senderInitial) throw new NotFoundException('Sender wallet not found');

      const recipientInitial = await tx.customerWallet.findUnique({ where: { customerId: recipientCustomerId } })
        ?? await tx.customerWallet.upsert({
          where: { customerId: recipientCustomerId },
          create: { customerId: recipientCustomerId, balance: 0 },
          update: {},
        });

      const walletIds = [senderInitial.id, recipientInitial.id].sort();
      for (const walletId of walletIds) {
        await tx.$queryRawUnsafe(
          'SELECT id FROM "CustomerWallet" WHERE id = $1 FOR UPDATE',
          walletId,
        );
      }

      const lockedSender = await tx.customerWallet.findUnique({ where: { id: senderInitial.id } });
      const lockedRecipient = await tx.customerWallet.findUnique({ where: { id: recipientInitial.id } });
      if (!lockedSender) throw new NotFoundException('Sender wallet not found');
      if (!lockedRecipient) throw new NotFoundException('Recipient wallet not found');
      if (lockedSender.status !== 'ACTIVE') throw new BadRequestException('Sender wallet is not active');
      if (lockedRecipient.status !== 'ACTIVE') throw new BadRequestException('Recipient wallet is not active');

      const senderPreviousBalance = Math.round(Number(lockedSender.balance) * 100) / 100;
      const recipientPreviousBalance = Math.round(Number(lockedRecipient.balance) * 100) / 100;
      if (senderPreviousBalance < amount) throw new BadRequestException('Insufficient wallet balance');
      const senderNewBalance = Math.round((senderPreviousBalance - amount) * 100) / 100;
      const recipientNewBalance = Math.round((recipientPreviousBalance + amount) * 100) / 100;

      const updatedSender = await tx.customerWallet.update({
        where: { id: lockedSender.id },
        data: { balance: senderNewBalance },
      });
      const updatedRecipient = await tx.customerWallet.update({
        where: { id: lockedRecipient.id },
        data: { balance: recipientNewBalance },
      });
      const reference = data.reference?.trim() || this.ref('TRF');
      const outgoing = await tx.walletTransaction.create({
        data: {
          customerId,
          type: 'TRANSFER_OUT',
          amount,
          previousBalance: senderPreviousBalance,
          newBalance: senderNewBalance,
          reference: reference + '-OUT',
          description: data.description ?? ('Transfer to ' + recipient.firstName + ' ' + recipient.lastName),
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });
      const incoming = await tx.walletTransaction.create({
        data: {
          customerId: recipientCustomerId,
          type: 'TRANSFER_IN',
          amount,
          previousBalance: recipientPreviousBalance,
          newBalance: recipientNewBalance,
          reference: reference + '-IN',
          description: data.description ?? ('Transfer from ' + sender.firstName + ' ' + sender.lastName),
          branchId: data.branchId,
          staffId: data.staffId,
        },
      });
      return { senderWallet: updatedSender, recipientWallet: updatedRecipient, outgoing, incoming };
    });
  }

}
