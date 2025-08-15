// Simple error logger: saves error details to ErrorLogs collection
import wixData from 'wix-data';

async function logError(error, context) {
    try {
        await wixData.insert("ErrorLogs", {
            errorMessage: error.message || String(error),
            context: context || "",
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Failed to log error:", e);
    }
}
// Velo Page Code for Safe Transport - Final Integrated Version
// This file includes proper backend web method integration

import wixData from 'wix-data';
import { storeVaultSecret, retrieveVaultSecret, processVaultData, cleanupVaultSecret } from 'backend/webmethods/backend_vault_secrets.web';
import { currentMember } from 'wix-members-frontend';
import wixLocation from 'wix-location';

let item = {};
let encode = {};
let bank = {};
let card = {};
let member = {};
let redirectUrl = null;

$w.onReady(async function () {
    try {
        // ✅ NEW: Capture redirect URL from query parameters
        const urlParams = wixLocation.query;
        redirectUrl = urlParams.returnTo || urlParams.redirect || urlParams.from;
        
        if (redirectUrl) {
            console.log("Redirect URL captured:", redirectUrl);
        } else {
            console.log("No redirect URL provided - will stay on vault page");
        }
        
        // CRITICAL: Resolve member data FIRST before any other operations
        member = await currentMember.getMember();
        
        if (!member || !member._id) {
            console.error("CRITICAL: No member data found - cannot proceed");
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Member authentication required. Please log in.";
            $w('#errorMsg').show();
        }
            return; // Stop execution if no member
        }
        
        console.log("Member resolved successfully:", member._id);
        
        $w('#dynamicDataset').onReady(() => {
            refreshItem();

            if (typeof item.approvedSeller === "boolean" && item.approvedSeller) {
                review();
            } else if (typeof item.sellerVerified === "boolean" && item.sellerVerified) {
                warn();
            } else {
                buyerReview();
            }

            $w('#saveCard').onClick(handleCardSave);
            $w('#saveAch').onClick(handleAchSave);

            $w('#changeCard').onClick(() => {
                $w("#adjCard").expand();
                // Set up placeholders when opening adjustment section
                resetCardAdjustmentFields();
            });
            $w('#changeBank').onClick(() => {
                $w("#adjBank").expand();
                // Set up placeholders when opening adjustment section
                resetachNoustmentFields();
            });

            // ✅ NEW: Proper update handlers for card and bank changes
            $w('#updateCard').onClick(handleCardUpdate);
            $w('#updateBank').onClick(handleBankUpdate);
            $w('#cancelCardUpdate').onClick(() => {
                $w("#adjCard").collapse();
                // Reset adjustment fields to current values
                resetCardAdjustmentFields();
            });
            $w('#cancelBankUpdate').onClick(() => {
               try {
    if ($w("#adjBank")) $w("#adjBank").expand();
    else if ($w("#achNo")) $w("#achNo").expand();
    else if ($w("#exit")) $w("#exit").expand();
    else console.log("Bank adjustment element not found - check element ID");
} catch (e) {
    console.log("Error expanding bank section:", e);
}
            });

            // Legacy handlers (keeping for compatibility)
            // $w('#button4').onClick(() => { 
            //     card = {}; 
            //     $w("#adjCard").collapse();
            // });
            // $w('#exitBank').onClick(() => { 
            //     bank = {}; 
            //     $w("#adjBank").collapse();
            // });

            // Real-time field updates for adjustment fields
            $w('#adjCcNo').onChange(() => { card.number = $w('#adjCcNo').value; });
            $w('#adjExp').onChange(() => { card.expDate = $w('#adjExp').value; });
            $w('#adjCv').onChange(() => { card.cvv = $w('#adjCv').value; });

            $w('#adjAch').onChange(() => { bank.accountNumber = $w('#adjAch').value; });
            $w('#adjRoute').onChange(() => { bank.routingNumber = $w('#adjRoute').value; });
        });
        
    } catch (error) {
        console.error("CRITICAL: Member resolution failed:", error);
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Failed to load member data. Please refresh page.";
            $w('#errorMsg').show();
        }
    }
});

function refreshItem() {
    item = $w('#dynamicDataset').getCurrentItem();
}

function scrubSensitiveData() {
    card = {};
    bank = {};
    encode = {};
    console.log("Sensitive transport objects scrubbed.");
}

// Store data in encode object
function safeSetFieldValue(fieldName, value) {
    encode[fieldName] = value;
}

// ✅ Store vault data securely using backend web method and Wix Secrets
async function storeVaultDataSecurely() {
    try {
        // Create unique vault instance ID (max 50 chars for Wix Secrets)
        const userId = (item.wixId || item._id).substring(0, 20);
        const timestamp = Date.now().toString().slice(-10);
        const vaultId = `v_${userId}_${timestamp}`;
        
        // Prepare secure payload
        const securePayload = {
            vaultId: vaultId,
            userId: item.wixId || item._id,
            timestamp: new Date().toISOString(),
            status: "in_transit",
            encode: encode,
            card: card,
            bank: bank
        };
        
        console.log(`Storing vault data securely with ID: ${vaultId}`);
        
        // ✅ Call backend web method directly (imported at top of file)
        const result = await storeVaultSecret(securePayload);
        
        if (result.success) {
            console.log("Secure vault storage completed:", result);
            
            // Show success Msg to user
            if ($w('#successMsg')) {
                $w('#successMsg').text = "Payment information stored securely";
                $w('#successMsg').show();
                setTimeout(() => $w('#successMsg').hide(), 3000);
            }
            
            return result;
        } else {
            throw new Error(result.error || "Failed to store vault data");
        }
        
    } catch (err) {
        console.error("Secure vault storage error:", err);
        
        // Show error Msg to user
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Failed to store payment information securely";
            $w('#errorMsg').show();
            setTimeout(() => $w('#errorMsg').hide(), 5000);
        }
        
        throw err;
    } // finally {
    //     scrubSensitiveData();
    // }
}

// ✅ Retrieve vault data for processing
async function retrieveVaultData(vaultId) {
    try {
        console.log(`Retrieving vault data for ID: ${vaultId}`);
        
        const result = await retrieveVaultSecret(vaultId);
        
        if (result.success) {
            console.log("Vault data retrieved successfully");
            return result.vaultData;
        } else {
            throw new Error(result.error || "Failed to retrieve vault data");
        }
        
    } catch (err) {
        console.error("Error retrieving vault data:", err);
        throw err;
    }
}

// ✅ Process vault data after payment processing
async function finalizeVaultProcessing(vaultId, processingResult) {
    try {
        console.log(`Finalizing vault processing for ID: ${vaultId}`);
        
        const result = await processVaultData(vaultId, processingResult);
        
        if (result.success) {
            console.log("Vault processing finalized successfully");
            
            // Clean up the vault secret after successful processing
            await cleanupVaultSecret(vaultId);
            
            return result;
        } else {
            throw new Error(result.error || "Failed to finalize vault processing");
        }
        
    } catch (err) {
        console.error("Error finalizing vault processing:", err);
        throw err;
    }
}

// ✅ Check if user has both card and bank info for approval
async function checkForSellerApproval() {
    try {
        refreshItem();
        
        // Check if user has both credit card and bank info
    const hasCard = encode.last4cc || item.last4cc;
    const hasBank = (encode.last4ach || item.last4ach) && (encode.last4route || item.last4route);
        
        console.log(`Checking approval status: hasCard=${hasCard}, hasBank=${hasBank}`);
        
        if (hasCard && hasBank && !item.approvedSeller) {
            console.log("User has both payment methods - approving seller");
            
            // Update user to approved seller status
            safeSetFieldValue("approvedSeller", true);
            
            try {
                // await $w("#dynamicDataset").save().then(() => $w("#dynamicDataset").refresh());
                let toApprove = Object.assign(encode, item)
                await wixData.save("VerifiedMembers", toApprove)
                // Check if already exists in approvedSellers to avoid duplicates
                const existingApproved = await wixData.query("approvedSellers")
                    .eq("_id", item._id)
                    .find();
                
                if (existingApproved.items.length === 0) {
                    await wixData.insert("approvedSellers", toApprove);
                    console.log("Seller approval completed successfully");
                } else {
                    console.log("User already exists in approvedSellers collection");
                }
                
            } catch (error) {
                console.error("Seller approval failed:", error);
            }
        } else {
            console.log("User does not have both payment methods yet - remaining as verified seller");
        }
        
    } catch (error) {
        console.error("Error checking seller approval:", error);
    }
}

async function handleCardSave() {
    if (item.sellerVerified === false) return;
    
    // CRITICAL: Verify member is resolved before proceeding
    if (!member || !member._id) {
        console.error("CRITICAL: Member not resolved, cannot save card");
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Member data not loaded. Please refresh page.";
            $w('#errorMsg').show();
        }
        return;
    }
    
    try {
        // Collect card data
        card.number = $w('#ccNo').value;
        card.cvv = $w('#cvv').value;
        card.expDate = $w('#exp').value;
        
        // Store last 4
    safeSetFieldValue("last4cc", card.number.slice(-4));
        encode.payee = member._id; // Now guaranteed to be valid
        
        // ✅ CRITICAL FIX: Store card data securely in Wix Secrets
        console.log("Storing card data securely in vault...");
        await storeVaultDataSecurely();
        
        // Update UI only after successful vault storage
        $w('#saveCard').disable();
        $w('#saveCard').label = "Card Saved";
        
        // Show masked card number
        $w('#ccNo').value = "••••••••••••" + card.number.slice(-4);
        
        // Check if both complete
        if (encode.last4cc && encode.last4ach) {
            await saveBothAndAdvance();
        }
        
    } catch (error) {
        console.error("Card save failed:", error);
        await logError(error, "handleCardSave");
        // Re-enable button on error
        $w('#saveCard').enable();
        $w('#saveCard').label = "Save Card";

        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Failed to save card securely. Please try again.";
            $w('#errorMsg').show();
        }
    }
}

async function handleAchSave() {
    if (item.sellerVerified === false) return;
    
    // CRITICAL: Verify member is resolved before proceeding
    if (!member || !member._id) {
        console.error("CRITICAL: Member not resolved, cannot save bank");
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Member data not loaded. Please refresh page.";
            $w('#errorMsg').show();
        }
        return;
    }
    
    try {
        // Collect bank data  
        bank.routingNumber = $w('#adjAch').value;
        bank.bankAccount = $w('#achNo').value;
        
    // Store last 4 (consistent naming)
    safeSetFieldValue("last4ach", bank.accountNumber.slice(-4));

        // Save bank info to VerifiedMembers collection using wixData
        await wixData.save("VerifiedMembers", {
            ...item,
            wixId: member._id,
            last4ach: encode.last4ach
        });

        // Gracefully refresh dataset to show updated last 4 digits
        if ($w("#dynamicDataset")) {
            await $w("#dynamicDataset").refresh();
        }
        
        // ✅ CRITICAL FIX: Store bank data securely in Wix Secrets
        console.log("Storing bank data securely in vault...");
        await storeVaultDataSecurely();
        
        // Update UI only after successful vault storage
        $w('#saveAch').disable();
        $w('#saveAch').label = "Bank Saved";
        
        // Show masked account number
        $w('#achNo').value = "••••••••••••" + bank.bankAccount.slice(-4);
        
        // Check if both complete
        if (encode.last4cc && encode.last4ach) {
            await saveBothAndAdvance();
        }
        
    } catch (error) {
        console.error("Bank save failed:", error);
        await logError(error, "handleAchSave");
        // Re-enable button on error
        $w('#saveAch').enable();
        $w('#saveAch').label = "Save Bank";

        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Failed to save bank data securely. Please try again.";
            $w('#errorMsg').show();
        }
    }
}

async function saveBothAndAdvance() {
    try {
        // CRITICAL: Final check that member is resolved before save
        if (!member || !member._id) {
            throw new Error("Member data not resolved - cannot save");
        }
        
        // CRITICAL: Verify all required data is present
        if (!encode.last4cc || !encode.last4ach || !encode.payee) {
            throw new Error("Payment data incomplete - missing required fields");
        }
        
        // Build complete update object with validated data
        const toUpdate = {
            ...item,
            wixId: member._id, // Now guaranteed to be valid
            fullName: `${item.firstName} ${item.lastName}`,
            email: item.email,
            firstName: item.firstName,
            lastName: item.lastName,
            memberref: member._id, // Now guaranteed to be valid
            approvalDate: (new Date()).toLocaleDateString(),
            verificationMethod: "Payment Collection",
            verificationDate: (new Date()).toLocaleDateString(),
            sellerVerified: true,
            status: "verified",
            memberState: 3,
            stateDescriptions: "Payment verified - approved seller",
            approvedBy: "admin",
            rvVerified: true,
            adminApproved: true,
            buyerVerified: true,
            approvedSeller: true,
            customerId: "",
            acctId: "",
            mainVault: "active",
            last4cc: encode.last4cc,
            last4ach: encode.last4ach,
            memberVault: "configured",
            payee: encode.payee // Now guaranteed to be valid
        };
        
        console.log("Attempting to save with validated data:", toUpdate);
        
        // Save to database - MUST succeed before advancing
        const saveResult = await wixData.save("VerifiedMembers", toUpdate);
        
        console.log("Save successful:", saveResult);
        
        // Clear sensitive data only after successful save
        card = {};
        bank = {};
        
        console.log("Both payment methods saved - user advanced to approved seller");
        
        // ✅ NEW: Redirect user back to where they came from
        await handleVaultCompletion();
        
    } catch (error) {
        console.error("CRITICAL ERROR: Save failed, user NOT advanced:", error);
        await logError(error, "saveBothAndAdvance");

        // Show detailed error to user
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = `Payment save failed: ${error.message}. Please try again.`;
            $w('#errorMsg').show();
        }

        // Do NOT advance user - keep them in vault
        throw error;
    }
}

// UI Flow Functions - Unchanged from original

function buyerReview() {
    console.log('approved seller or buyer should just show values', item);
    $w('#warn').collapse();
    $w("#createVault").collapse();
    $w("#reviewVault").expand();
    if (item.buyerVerified) {
        $w("#buyer").expand();
        $w("#bankTop").collapse();
        $w("#bankBottom").collapse();
    } else {
        $w("#approved").expand();
    }
}

function review() {
    console.log('approved seller or buyer should just show values', item);
    $w('#warn').collapse();
    $w("#createVault").collapse();
    $w("#reviewVault").expand();
    $w("#buyer").collapse();
    $w("#bankTop").expand();
    $w("#bankBottom").expand();
    $w("#approved").expand();
}

function warn() {
    console.log('unproven seller get data ', item);
    $w('#warn').expand();
    $w("#getData").expand();
    $w("#buyer").collapse();
    $w("#approved").collapse();
    $w("#createVault").expand();
    $w("#reviewVault").collapse();
}

// ✅ NEW: Handle vault completion and redirect
async function handleVaultCompletion() {
    try {
        console.log("Vault completion - preparing redirect");
        
        // Show completion message
        if ($w('#successMsg')) {
            $w('#successMsg').text = "Payment information saved successfully!";
            $w('#successMsg').show();
        }
        
        // Wait a moment for user to see success message
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        if (redirectUrl) {
            console.log("Redirecting user back to:", redirectUrl);
            
            // Validate redirect URL for security (basic check)
            if (isValidRedirectUrl(redirectUrl)) {
                wixLocation.to(redirectUrl);
            } else {
                console.warn("Invalid redirect URL detected, staying on vault page:", redirectUrl);
                showRedirectError();
            }
        } else {
            console.log("No redirect URL - user stays on vault page");
            // Could show a "completion" state or navigate to a default page
            showVaultCompletionState();
        }
        
    } catch (error) {
        console.error("Error handling vault completion:", error);
        showRedirectError();
    }
}

// ✅ NEW: Validate redirect URL for security (following standardized schema)
function isValidRedirectUrl(url) {
    try {
        // CRITICAL: Handle null/undefined/non-string inputs first
        if (!url || typeof url !== 'string') {
            return false;
        }
        
        // Must be relative URL (start with /)
        if (!url.startsWith('/')) {
            return false;
        }
        
        // Length limit for security
        if (url.length > 200) {
            return false;
        }
        
        // CRITICAL: Block path traversal attempts BEFORE regex check
        if (url.includes('../') || url.includes('..\\') || url.includes('..%2F') || url.includes('..%5C')) {
            return false;
        }
        
        // Block encoded path traversal
        if (url.includes('%2E%2E%2F') || url.includes('%2E%2E%5C')) {
            return false;
        }
        
        // Allow only safe characters: alphanumeric, hyphens, underscores, slashes, query params, fragments
        if (!/^\/[a-zA-Z0-9\-_\/\?&=#]*$/.test(url)) {
            return false;
        }
        
        // Block null bytes (encoded and unencoded)
        if (url.includes('%00') || url.includes('\0')) {
            return false;
        }
        
        // Additional security: block double slashes that could bypass filters
        if (url.includes('//')) {
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Error validating redirect URL:", error);
        return false;
    }
}

// ✅ NEW: Show redirect error
function showRedirectError() {
    if ($w('#errorMsg')) {
        $w('#errorMsg').text = "Unable to redirect. Your payment information has been saved successfully.";
        $w('#errorMsg').show();
        setTimeout(() => $w('#errorMsg').hide(), 5000);
    }
}

// ✅ NEW: Show vault completion state
function showVaultCompletionState() {
    try {
        // Hide all input sections
        if ($w('#createVault')) $w('#createVault').collapse();
        if ($w('#warn')) $w('#warn').collapse();
        
        // Show completion/review state
        if ($w('#reviewVault')) $w('#reviewVault').expand();
        if ($w('#approved')) $w('#approved').expand();
        
        // Show success message
        if ($w('#successMsg')) {
            $w('#successMsg').text = "Vault setup complete! You are now an approved seller.";
            $w('#successMsg').show();
        }
        
        console.log("Vault completion state displayed");
    } catch (error) {
        console.error("Error showing vault completion state:", error);
    }
}

// ✅ NEW: Handle card update from adjustment fields
async function handleCardUpdate() {
    if (item.sellerVerified === false) return;
    
    // CRITICAL: Verify member is resolved before proceeding
    if (!member || !member._id) {
        console.error("CRITICAL: Member not resolved, cannot update card");
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Member data not loaded. Please refresh page.";
            $w('#errorMsg').show();
        }
        return;
    }
    
    try {
        // Validate adjustment fields have data
        if (!$w('#adjCcNo').value || !$w('#adjExp').value || !$w('#adjCv').value) {
            if ($w('#errorMsg')) {
                $w('#errorMsg').text = "Please fill in all card fields before updating.";
                $w('#errorMsg').show();
            }
            return;
        }
        
        // Collect updated card data from adjustment fields
        card.number = $w('#adjCcNo').value;
        card.cvv = $w('#adjCv').value;
        card.expDate = $w('#adjExp').value;
        
        // Assign last4cc to encode for consistency
        encode.last4cc = card.number.slice(-4);
        encode.payee = member._id;
        await wixData.save("VerifiedMembers", {
            ...item,
            wixId: member._id,
            last4cc: encode.last4cc,
            payee: encode.payee
        });

        // Also update approvedSellers dataset with latest info

        // Store updated card data securely in Wix Secrets and save result in frontend
    vaultResult = await storeVaultDataSecurely();
        encode.vaultResult = vaultResult;

        // Update approvedSellers: fetch, push vaultResult, save
        let approvedQuery = await wixData.query("approvedSellers").eq("wixId", member._id).find();
        let approvedRecord = approvedQuery.items[0];
        if (approvedRecord) {
            if (!Array.isArray(approvedRecord.vault)) approvedRecord.vault = [];
            approvedRecord.vault.push(vaultResult);
            // Explicitly update card fields
            approvedRecord.last4cc = encode.last4cc;
            approvedRecord.cardNumber = card.number;
            approvedRecord.cardExpDate = card.expDate;
            approvedRecord.cardCvv = card.cvv;
            approvedRecord.payee = encode.payee;
            await wixData.save("approvedSellers", approvedRecord);
        }

        // Store updated card data securely in Wix Secrets and save result in frontend
        const vaultResult = await storeVaultDataSecurely();
        encode.vaultResult = vaultResult;

        // Refresh dataset to show updated last 4 digits
        if ($w("#dynamicDataset")) {
            await $w("#dynamicDataset").refresh();
        }
        
        // Update UI only after successful vault storage
        $w('#updateCard').disable();
        $w('#updateCard').label = "Card Updated";
        
        // Update main card display with masked number
        $w('#ccNo').value = "••••••••••••" + card.number.slice(-4);
        $w('#exp').value = card.expDate;
        
        // Collapse adjustment section
        $w("#adjCard").collapse();
        
        // Show success message
        if ($w('#successMsg')) {
            $w('#successMsg').text = "Card information updated successfully";
            $w('#successMsg').show();
            setTimeout(() => $w('#successMsg').hide(), 3000);
        }
        
        // Re-enable update button after delay
        setTimeout(() => {
            $w('#updateCard').enable();
            $w('#updateCard').label = "Update Card";
        }, 3000);
        
    } catch (error) {
        console.error("Card update failed:", error);
        // Re-enable button on error
        $w('#updateCard').enable();
        $w('#updateCard').label = "Update Card";
        
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Failed to update card securely. Please try again.";
            $w('#errorMsg').show();
        }
    }
}

// ✅ NEW: Handle bank update from adjustment fields
async function handleBankUpdate() {
    if (item.sellerVerified === false) return;
    
    // CRITICAL: Verify member is resolved before proceeding
    if (!member || !member._id) {
        console.error("CRITICAL: Member not resolved, cannot update bank");
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Member data not loaded. Please refresh page.";
            $w('#errorMsg').show();
        }
        return;
    }
    
    try {
        // Validate adjustment fields have data
        if (!$w('#adjAch').value || !$w('#adjAch').value) {
            if ($w('#errorMsg')) {
                $w('#errorMsg').text = "Please fill in all bank fields before updating.";
                $w('#errorMsg').show();
            }
            return;
        }
        
        // Collect updated bank data from adjustment fields
        bank.accountNumber = $w('#adjAch').value;
        bank.routingNumber = $w('#adjAch').value;
        
            // Save updated bank info to VerifiedMembers collection using wixData (single save, no legacy setter)
            const last4ach = bank.accountNumber.slice(-4);
            await wixData.save("VerifiedMembers", {
                ...item,
                wixId: member._id,
                last4ach: last4ach
            });

            // Also update approvedSellers dataset with latest info

        // Store updated bank data securely in Wix Secrets and save result in frontend
        console.log("Updating bank data securely in vault...");
    vaultResult = await storeVaultDataSecurely();
        encode.vaultResult = vaultResult;

        // Update approvedSellers: fetch, push vaultResult, save
        let approvedQuery = await wixData.query("approvedSellers").eq("wixId", member._id).find();
        let approvedRecord = approvedQuery.items[0];
        if (approvedRecord) {
            if (!Array.isArray(approvedRecord.vault)) approvedRecord.vault = [];
            approvedRecord.vault.push(vaultResult);
            await wixData.save("approvedSellers", approvedRecord);
        }

        // Gracefully refresh dataset to show updated last 4 digits
        if ($w("#dynamicDataset")) {
            await $w("#dynamicDataset").refresh();
        }
        
        // Update UI only after successful vault storage
        $w('#updateBank').disable();
        $w('#updateBank').label = "Bank Updated";
        
        // Update main bank display with masked numbers
        $w('#achNo').value = "••••••••••••" + bank.accountNumber.slice(-4);
        $w('#adjAch').value = bank.routingNumber;
        
        // Collapse adjustment section
        $w("#adjBank").collapse();
        
        // Show success message
        if ($w('#successMsg')) {
            $w('#successMsg').text = "Bank information updated successfully";
            $w('#successMsg').show();
            setTimeout(() => $w('#successMsg').hide(), 3000);
        }
        
        // Re-enable update button after delay
        setTimeout(() => {
            $w('#updateBank').enable();
            $w('#updateBank').label = "Update Bank";
        }, 3000);
        
    } catch (error) {
        console.error("Bank update failed:", error);
        // Re-enable button on error
        $w('#updateBank').enable();
        $w('#updateBank').label = "Update Bank";
        
        if ($w('#errorMsg')) {
            $w('#errorMsg').text = "Failed to update bank data securely. Please try again.";
            $w('#errorMsg').show();
        }
    }
}

// ✅ NEW: Reset card adjustment fields with placeholders showing last 4
function resetCardAdjustmentFields() {
    try {
        // Get current card number and show last 4 as placeholder
        const currentCardNumber = $w('#ccNo').value || "";
        const last4 = currentCardNumber.includes("••••") ? 
                     currentCardNumber.slice(-4) : 
                     (item.last4cc || "****");
        
        // Set placeholders to show current info
        $w('#adjCcNo').placeholder = `••••••••••••${last4}`;
        $w('#adjCcNo').value = "";
        
        $w('#adjExp').placeholder = $w('#exp').value || "MM/YY";
        $w('#adjExp').value = $w('#exp').value || "";
        
        $w('#adjCv').placeholder = "CVV";
        $w('#adjCv').value = "";
        
        // Clear card object
        card = {};
        
        console.log("Card adjustment fields reset with placeholders");
    } catch (error) {
        console.error("Error resetting card adjustment fields:", error);
    }
}

// ✅ NEW: Reset bank adjustment fields with placeholders showing last 4
function resetachNoustmentFields() {
    try {
        // Get current account number and show last 4 as placeholder
        const currentAccountNumber = $w('#achNo').value || "";
        const last4 = currentAccountNumber.includes("••••") ? 
                     currentAccountNumber.slice(-4) : 
                     (item.last4ach || item.Last4Ach || "****");
        
        // Set placeholders to show current info
        $w('#adjAch').placeholder = `••••••••••••${last4}`;
        $w('#adjAch').value = "";
        
        $w('#adjAch').placeholder = $w('#adjAch').value || "Routing Number";
        $w('#adjAch').value = $w('#adjAch').value || "";
        
        // Clear bank object
        bank = {};
        
        console.log("Bank adjustment fields reset with placeholders");
    } catch (error) {
        console.error("Error resetting bank adjustment fields:", error);
    }
}

// async function updateAndExit(role) {
// 	const newRole = await setRole(role)
// 	console.log('new role assigned. Now returning to Seller Dashboard') 
// }


// Export functions for potential use in other modules
export { storeVaultDataSecurely, retrieveVaultData, finalizeVaultProcessing };
