
import { searchProductsServer } from '../src/lib/edible-api';

async function main() {
    console.log('--- Debugging Edible API ---');

    // 1. Check "birthday" search for tags
    console.log('\nSearching "birthday"...');
    const birthdayResults = await searchProductsServer('birthday');
    if (birthdayResults.length > 0) {
        console.log(`Found ${birthdayResults.length} products.`);
        console.log('Sample Product 1:', {
            name: birthdayResults[0].name,
            isOneHourDelivery: birthdayResults[0].isOneHourDelivery,
            promo: birthdayResults[0].promo,
            productImageTag: birthdayResults[0].productImageTag
        });
    } else {
        console.log('No results for "birthday".');
    }

    // 2. Check "same day delivery" explicit search
    console.log('\nSearching "same day delivery"...');
    const sameDayResults = await searchProductsServer('same day delivery');
    if (sameDayResults.length > 0) {
        // Find one that SHOULD be same day
        const oneHour = sameDayResults.find(p => p.isOneHourDelivery);
        if (oneHour) {
            console.log('Found Same Day Product:', {
                name: oneHour.name,
                isOneHourDelivery: oneHour.isOneHourDelivery
            });
        } else {
            console.log('WARNING: No products marked isOneHourDelivery even for "same day delivery" query.');
            console.log('First result:', sameDayResults[0]);
        }
    } else {
        console.log('No results for "same day delivery".');
    }

    // 3. Check ZIP code passing
    console.log('\nSearching "birthday" with ZIP 10001...');
    const zipResults = await searchProductsServer('birthday', '10001');
    if (zipResults.length > 0) {
        // Compare with first search - difficult unless API changes based on ZIP
        // Just log first result to see if anything is different or if it worked
        console.log('ZIP Search Result 1:', {
            name: zipResults[0].name,
            isOneHourDelivery: zipResults[0].isOneHourDelivery
        });
    } else {
        console.log('No results for ZIP search.');
    }
}

main().catch(console.error);
