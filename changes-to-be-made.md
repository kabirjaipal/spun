1. there is not that one accounting software for all bro, okay. we have to make the seprate modules for the different types of companies, like textiles, diamond , etc.. etc.. , in that we also add the sub category of that market dude. and the main core accounting engine will remain same, but that market specific module and there terms and units to mersure will different according to there needs dude , okay.

2. company creation is the different bro, its not that simple to make the account with the company man.
for company creation we required all that things to the user bro :
- Name of the company
- address with pincode
- state 
- GST number
- phone and email address 
- currency symbol with nation name
- bank name
- account number
- IFSC code
- branch name
- account type , etc.. etc..

if GST applicable ? : yes or not .
if yes:
- GST no.
- state code
- city
- type (Regular, composition, export)

bank details :
- bank name (select from list/ dropdown)
- account name
- IFSC code (select from list/ dropdown)
- branch name (come from IFSC and code selection)
- account type (current account, CC account, OD account, saving account, other account)

3. now we have to make the gateway and master bro:
- we have to make the account (ledger) master
- group master (create group or alter group)
- inventory master
- job master / mill master

if the create group was there: (fixed group and add new group)
- capital account
- sales account
- purchase account
- bank account (saving, current, etc..)
- stock in hand
- sales return
- purchase return
- direct expenses
- indirect income
- profite and loss
- unsecured loans
- secured loans
- deposits and advance assets 
- fixed assets
- investement
- loan (assets)
- preliminery expenses
- cash in hand
- provisions
- sundry deborts 
- sundry creditors
- suspense account


4. now we have to make the account ledger master :
create ledger / alter ledger

- name of ledger
- short name
- address
- group (select from group or create new group)
- GST number
- MSME type - (registered - (micro , small , medium) / non registered)
- pan number
- is TDS applicable - yes/ no
- if yes - TDS Rate
- credit day's
- rate of interest

5. now we have to make the inventory master bro :
inventory creation / alter
group of inventory / alter
categories of inventory / alter
unit of measurement

Group of inventory: 
- create group
- alter group

categories of inventory
- create category
- alter category

units of measurement:
- create unit
- alter unit

fixed units - PCS - Pieces:
- MTR-meters, KGS - kilograme, GRM - Grams, LTR - Liters, BOX- BOX

6. creation of inventory : 
create / alter
- name of inventory
- HSN code
- group
- categories
- GST type (state / center)
- GST percentage (5%, 12%, 30%, etc...)
- unit of measurement
- cosnumable or saling goods (radio button to select)
- consume with (list of inventory) - (like : 1 meter cloth = 3 LTR color)
- consumption ratio
- shortage percentage


7. categories of inventory - create:
- name of category - coloth, color, chemical, etc.. etc..
- alter

8. Group of inventory: - create
- name of group (cosnumable / salling)
- alter

9. unit of measurement: - create
- create unit of measurement + fix unit
- alter

10. job master :
- name of party
- address of party
- GST no.  (from GST site taken the address and details)
- GST type(regular, composition, un regular)
- city
- state code
- phone number
- MSME registered (yes/ no), registration type


11. mill master:
- name of mill (selection, with the addeding feature for  the new mill)
- address of mill
- GST no. 
- GST type
- city
- state code
- phone numner
- MSME registered, registration type


12. transactions :
- purchase
- sales
- job work
- mill
- general
- inventory
- payment and received 

purchase:
- grey purchase
- finished purchase
- cosnumable goods purchase
- other purchase

purchase interface :
- name of party (select or create the new entry of it(if created , direct redirect to the account master, bro))
- sr. no. and date
- invoice number
- date 
- name of goods purchased

- broker (select or create the new entry of it(if created , direct redirect to the account master, bro))

- haste(select or create the new entry of it(if created , from inventory))

- lr no.
- lr date
- transport
 
now there was a table there, which have these :
- name of item
- HSN code
- Quantity (PCS(count) and MTR(taka details))
- unit
- Rate
- Taxable amount (at the bottom of the this column ,incule the total of this column)
- SGST (at the bottom of the this column ,incule the total of this column)
- CGST(at the bottom of the this column ,incule the total of this column)
- IGST (at the bottom of the this column ,incule the total of this column)
- Net amount(at the bottom of the this column ,incule the total of this column)

and i have the thing like :
suppose : 10 mtr * 100 rate = 1000rs. , but fold of that thing is 98, which is fold = 98, then now this will happen like : 10mtr * 100 rate * 98 fold / 100 = 980 rs.

so we got that thing man, okay.

purchase return :
- lr no. 
- lr date
- transport
- date
- pr no. (multiple purchase return bro, not only one at a time dude, like 2,3,4 ,5, etc.. can be possible to do that man , okay)

- against invoice
- sr. no.
- name of party (which is select only)

now the table of that :
- name of item
- HSN
- Quantity (PCS(count) and meter(taka details))
- rate
- unit
- Taxable amount
- SGST
- CGST
- IGST
- Net amount

and after all that things man, Quantity is greater than inward dude, okay

JOB work:
- Job outward
- job inward
- job transfered
- job goods lost

job outward:
- sr. no. 
- date
- name of party (select/ create)
- GST no. (auto)
- lot no.
- address (auto)
- broker/ haste
- vehicle no.
- person name

then table dude :
- name of goods
- HSN
- PCS
- meter
- fold
- job type (selection)
- job rate (selection)
- per pcs/mtr (selection)
- amount (total of this column)
at the end of the entire table , there was details imput field, where we write the details of that job dude , okay

do you want to print - yes / no
if yes, then wanna print job rate ? - yes / no
print amount - yes/ no



agar party khud job karne wali ho to inward and outward ka system alag ho jaygea.

job inward:
- sr. no.
- name of party(select from job parties)
- date
- broker
- vehicle no.
- person name
- haste
- lot no (select from job party)

 then now there was a table:

- name of goods (auto from job outward)
- Quantity (pcs and meter)
- job rate (auto)
- per PCS/meter (auto)
- fold
- amount (total of this column)
- shortage (in the same unit outward-inward will be shown lot wise)

do you want to print 
print job rate
print amount


mill outward: (Dispatch)
- sr no.
- name of mill(select from mill/ create)
- address (auto)
- GST no (auto)
- city
- broker
- vehicle no
- name of person

now there was a table bro :
- sr. no.
- Quality
- pcs
- meter
- date
- amount
- rate
- finish

mill inward:
- sr no
- name of mill (select)
- date
- mill challan (gate pass) number
- our challan number (select) (from mill  outward)
- broker
- haste
- vehicle no
- person

 now the table dude :
- lot no.
- outward sr no
- Quality (auto)
- pcs
- meter
- rate
- amount (total)
- shortage (outward - inward)

agar sr. no. blank me enter dabe too total karke bahar aa jaye.

lot agar adhura aaya ha too shortage jo mill ne likha ho dala no likha ho too blank aaya and jab lot pura ho jaye too eak saath calculation karke aaya

agar party, khud hi mill ho too inward and outward dono system ulta ho jaygea.

sales :
- grey sales
- finished sales
- other sales

now its grey sales layout to fill dude :
- name of party
- date
- invoice no
- city
- GST no
- sales order no
- lr no
- lr date
- transport
- broker/haste
- discount

now its table bro :
- name of item
- HSN
- Quantity (pcs/ meter)
- per unit
- rate
- GST %
- taxable amount (auto : rate * meter or pcs) (total)

GST details : -------------------

- HSN
- rate
- taxable amount (auto)
- CGST
- SGST & IGST (GST total)
- discount %
- amount 
- net amount

print option as well dude , okay

finished sales (same as above dude , okay)

other sales
same as above, but no selection and auto options

payment and receipt
payment: (from unpaid)

- name of party (select)
- amount of pay (total of selected bills)
- cheque no. (cheque no., cash, RTGS no., NEFT no., etc..)
- against bill no. (select bills from outstanding list of party)

 then table bro :

- bill no.
- date
- bill amount (total will be = amount to pay)
- days
- interest

receipts:(from unpaid)
- name of party (select)
- amount received
- cheque no. (cheque, cash, RTGS, NEFT, etc)
- against bill no. (select bill from outstanding list of party)

now table dude :
- bill no.
- date
- bill amount
- days
- interest

amount received and bills amount total will be matched.

payment and receipt return cheque:(from paid)
- name of party (select)
- return amount
- cheque no.
- against bill no.

and then table dude :
- bill no. 
- date
- bill amount
- days
- interest

reprensent the cheque entery - yes / no

direct bill entry : (it will not going in trading account)
- sr. no.
- name of party
- date
- invoice number
- purchase item (goods , service, other)

and then table dude :
- name of goods
- HSN code
- Quantity (pcs and mtr)
- rate
- taxable amount
- CGST
- SGST
- IGST
- net amount (less discount , then total)

general entry:
debit ac name---------------- amount
               credit account name ---------- amount

remark : -------------------


inventory entires:
- lot transfer:
- date
- lot number (select from mill and job outward)
- sr. no.
- transfer to - name of party(select)


credit note:
- cr. no.
- name of party(select from purchase parties)
- date
- against bill no (select from data file (sale))

 now the table bro:

- name of item (selection)
- HSN (auto)
- Quantity (pcs or meter)
- rate (auto from bill and manual)
- taxable amount (rate * Quantity)
- SGST
- CGST
- IGST
- net amount


debit note:
- dr. note no.
- date
- name of party (select from purchase party)
- against bill no. (select from data (purchase))

same as above